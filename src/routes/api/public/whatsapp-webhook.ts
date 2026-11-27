import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ehPedidoSair,
  somenteDigitos,
  evolutionSendText,
} from "@/lib/whatsapp.server";
import {
  extractEvolutionText,
  extrairNotaNps,
  resolveNpsAlertRecipient,
} from "@/lib/whatsapp-transport.server";
import {
  cancelPendingAutomationLogs,
  findPostVisitNpsRule,
} from "@/lib/whatsapp-automation.server";

/**
 * Webhook da Evolution API (evento MESSAGES_UPSERT).
 * Função: opt-out automático — se o cliente responder "SAIR" (ou parar/stop/
 * cancelar/remover), revogamos o opt-in dele na empresa dona da instância e
 * marcamos os envios pendentes dele como 'optout'. Ele nunca mais recebe.
 * Sempre responde 200: webhook que falha faz a Evolution retentar em rajada.
 *
 * PR #232 (Item 2, parte 1): restaura o fluxo original do PR #103 (commit
 * 8e2467d) e acrescenta a auditoria do opt-out (marketing_opt_out_at/reason)
 * + uma única mensagem de confirmação via Evolution, enviada só quando o
 * contato tinha opt-in ativo — para não criar loop nem responder a quem
 * nunca autorizou.
 *
 * PR #233 (Item 2, parte 2): SAIR também cancela os agendamentos pendentes
 * das réguas; e a resposta 1–5 para a pesquisa NPS completa o agendamento
 * (4–5: link do Google Meu Negócio; 1–3: alerta interno + agradecimento).
 */
export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: any = await request.json().catch(() => null);
          const evento = String(body?.event || "").toLowerCase();
          if (!body || (evento && !evento.includes("messages") && !evento.includes("upsert"))) {
            return Response.json({ ok: true, ignored: true });
          }
          const instanceName: string | null =
            body?.instance || body?.instanceName || body?.data?.instance || null;
          const data = body?.data || {};
          const key = data?.key || {};
          if (key?.fromMe) return Response.json({ ok: true, ignored: "fromMe" });
          const remoteJid = String(key?.remoteJid || "");
          // Mensagem de grupo não é opt-out de ninguém.
          if (remoteJid.endsWith("@g.us")) return Response.json({ ok: true, ignored: "group" });
          const texto: string = extractEvolutionText(data?.message);
          const telefone = somenteDigitos(remoteJid);

          if (ehPedidoSair(texto)) {
            if (!instanceName || telefone.length < 12) {
              return Response.json({ ok: true, ignored: "missing-data" });
            }
            return await processarOptOut(instanceName, telefone);
          }

          // Resposta da pesquisa NPS (PR #233): um dígito sozinho de 1 a 5.
          const nota = extrairNotaNps(texto);
          if (nota === null) return Response.json({ ok: true, ignored: "not-optout" });
          if (!instanceName || telefone.length < 12) {
            return Response.json({ ok: true, ignored: "missing-data" });
          }
          return await processarRespostaNps(instanceName, telefone, nota);
        } catch {
          return Response.json({ ok: true, ignored: "error" });
        }
      },
    },
  },
});

async function processarOptOut(instanceName: string, telefone: string) {
  const variantes = variantesTelefone(telefone);
  const admin: any = supabaseAdmin;
  const { data: instancia } = await admin
    .from("whatsapp_instancias")
    .select("id, company_id")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!instancia) return Response.json({ ok: true, ignored: "instance-not-found" });

  const agora = new Date().toISOString();
  // Revoga o opt-in do contato nesta empresa (visitors guarda com '+').
  const { data: visitantes } = await admin
    .from("visitors")
    .select("id, whatsapp_opt_in")
    .eq("company_id", instancia.company_id)
    .in(
      "phone_e164",
      variantes.map((v) => `+${v}`),
    );
  const ids = (visitantes || []).map((v: any) => v.id);
  const tinhaOptIn = (visitantes || []).some((v: any) => v.whatsapp_opt_in === true);
  if (ids.length > 0) {
    await admin
      .from("visitors")
      .update({
        whatsapp_opt_in: false,
        marketing_opt_out_at: agora,
        marketing_opt_out_reason: "whatsapp_keyword",
      })
      .in("id", ids);
    await admin
      .from("crm_leads")
      .update({ whatsapp_opt_in: false, do_not_contact: true })
      .eq("company_id", instancia.company_id)
      .in("visitor_id", ids);
  }
  // Tira o número de todas as filas pendentes da empresa.
  await admin
    .from("whatsapp_fila")
    .update({ status: "optout" })
    .eq("company_id", instancia.company_id)
    .in("telefone", variantes)
    .eq("status", "pendente");
  // Cancela os agendamentos pendentes das réguas (PR #233). A tabela só
  // existe depois da migration aplicada — sem ela, só não cancela nada.
  await cancelPendingAutomationLogs(admin, { visitorIds: ids }).catch(() => undefined);

  // Confirmação única, só para quem tinha opt-in ativo (evita loop).
  if (tinhaOptIn) {
    await enviarConfirmacaoOptOut(instanceName, telefone).catch(() => undefined);
  }

  return Response.json({ ok: true, optout: telefone, visitantes: ids.length });
}

async function processarRespostaNps(instanceName: string, telefone: string, nota: number) {
  const admin: any = supabaseAdmin;
  const { data: instancia } = await admin
    .from("whatsapp_instancias")
    .select("id, company_id")
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (!instancia) return Response.json({ ok: true, ignored: "instance-not-found" });

  const variantes = variantesTelefone(telefone);
  const ha24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let log: any = null;
  try {
    const { data } = await admin
      .from("whatsapp_automation_logs")
      .select("id, branch_id, visitor_id")
      .eq("company_id", instancia.company_id)
      .in(
        "phone_e164",
        variantes.map((v) => `+${v}`),
      )
      .eq("rule_type", "post_visit_nps")
      .eq("status", "awaiting_nps_reply")
      .gte("sent_at", ha24h)
      .order("sent_at", { ascending: false })
      .limit(1);
    log = data?.[0] || null;
  } catch {
    // Tabela de automações ainda não existe (migration não aplicada): a
    // resposta só não é registrada — o webhook continua 200.
    return Response.json({ ok: true, ignored: "nps-unavailable" });
  }
  if (!log) return Response.json({ ok: true, ignored: "not-nps" });

  const agora = new Date().toISOString();
  await admin
    .from("whatsapp_automation_logs")
    .update({ status: "completed", nps_score: nota, replied_at: agora })
    .eq("id", log.id);

  if (nota >= 4) {
    const regra = await findPostVisitNpsRule(admin, {
      companyId: instancia.company_id,
      branchId: log.branch_id,
    }).catch(() => null);
    if (regra?.google_review_url) {
      await evolutionSendText(
        instanceName,
        telefone,
        `Obrigado! Se puder, deixe sua avaliação aqui: ${regra.google_review_url}`,
      ).catch(() => undefined);
    }
  } else {
    const destinatario = await resolveNpsAlertRecipient(admin, {
      companyId: instancia.company_id,
      branchId: log.branch_id,
    }).catch(() => null);
    if (destinatario) {
      await admin
        .from("system_notifications")
        .insert({
          recipient_user_id: destinatario,
          event_key: "whatsapp_nps_baixo",
          category: "whatsapp",
          severity: "warning",
          title: `NPS ${nota}/5 no WhatsApp`,
          description: `Um visitante avaliou ${nota}/5 após a visita. Vale falar com ele para entender o que pode melhorar.`,
          company_id: instancia.company_id,
        })
        .catch(() => undefined);
    }
    await evolutionSendText(
      instanceName,
      telefone,
      "Obrigado por responder! Seu feedback ajuda a gente a melhorar.",
    ).catch(() => undefined);
  }

  return Response.json({ ok: true, nps: nota, log: log.id });
}

/**
 * Variantes do telefone com e sem o 9º dígito (Brasil): o cadastro pode ter
 * uma forma e a Evolution entregar a outra. Ex.: 5547997049730 <-> 554797049730.
 */
function variantesTelefone(digitos: string): string[] {
  const out = [digitos];
  if (digitos.startsWith("55") && digitos.length === 13 && digitos[4] === "9") {
    out.push(digitos.slice(0, 4) + digitos.slice(5));
  } else if (digitos.startsWith("55") && digitos.length === 12 && digitos[4] !== "9") {
    out.push(`${digitos.slice(0, 4)}9${digitos.slice(4)}`);
  }
  return [...new Set(out)];
}

async function enviarConfirmacaoOptOut(instanceName: string, telefone: string): Promise<void> {
  await evolutionSendText(
    instanceName,
    telefone,
    "Pronto! Seu número foi removido da nossa lista e você não receberá mais ofertas por aqui.",
  );
}
