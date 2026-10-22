import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ehPedidoSair, somenteDigitos } from "@/lib/whatsapp.server";

/**
 * Webhook da Evolution API (evento MESSAGES_UPSERT).
 * Função: opt-out automático — se o cliente responder "SAIR" (ou parar/stop/
 * cancelar/remover), revogamos o opt-in dele na empresa dona da instância e
 * marcamos os envios pendentes dele como 'optout'. Ele nunca mais recebe.
 * Sempre responde 200: webhook que falha faz a Evolution retentar em rajada.
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
          const texto: string =
            data?.message?.conversation ||
            data?.message?.extendedTextMessage?.text ||
            "";
          if (!ehPedidoSair(texto)) return Response.json({ ok: true, ignored: "not-optout" });
          const telefone = somenteDigitos(key?.remoteJid || "");
          if (!instanceName || telefone.length < 12) {
            return Response.json({ ok: true, ignored: "missing-data" });
          }

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
            .select("id")
            .eq("company_id", instancia.company_id)
            .eq("phone_e164", `+${telefone}`);
          const ids = (visitantes || []).map((v: any) => v.id);
          if (ids.length > 0) {
            await admin
              .from("visitors")
              .update({ whatsapp_opt_in: false, marketing_consent_revoked_at: agora })
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
            .eq("telefone", telefone)
            .eq("status", "pendente");

          return Response.json({ ok: true, optout: telefone, visitantes: ids.length });
        } catch {
          return Response.json({ ok: true, ignored: "error" });
        }
      },
    },
  },
});
