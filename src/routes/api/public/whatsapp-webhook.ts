import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehPedidoSair, somenteDigitos, evolutionConfig } from "@/lib/whatsapp.server";

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
          const texto: string =
            data?.message?.conversation ||
            data?.message?.extendedTextMessage?.text ||
            data?.message?.buttonsResponseMessage?.selectedDisplayText ||
            "";
          if (!ehPedidoSair(texto)) return Response.json({ ok: true, ignored: "not-optout" });
          const telefone = somenteDigitos(remoteJid);
          if (!instanceName || telefone.length < 12) {
            return Response.json({ ok: true, ignored: "missing-data" });
          }
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

          // Confirmação única, só para quem tinha opt-in ativo (evita loop).
          if (tinhaOptIn) {
            await enviarConfirmacaoOptOut(instanceName, telefone).catch(() => undefined);
          }

          return Response.json({ ok: true, optout: telefone, visitantes: ids.length });
        } catch {
          return Response.json({ ok: true, ignored: "error" });
        }
      },
    },
  },
});

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
  const { url, key, configurado } = evolutionConfig();
  if (!configurado) return;
  const res = await fetch(`${url}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({
      number: telefone,
      text: "Pronto! Seu número foi removido da nossa lista e você não receberá mais ofertas por aqui.",
    }),
  });
  if (!res.ok) throw new Error(`Evolution ${res.status}`);
}
