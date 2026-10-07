import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

export const Route = createFileRoute("/api/public/whatsapp-operational-webhook")({ server: { handlers: {
  GET: async ({ request }) => {
    const url = new URL(request.url); const token = url.searchParams.get("hub.verify_token"); const challenge = url.searchParams.get("hub.challenge");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("whatsapp_operational_integrations" as any).select("verify_token,status").eq("status", "configured").maybeSingle();
    return data && token === data.verify_token && challenge ? new Response(challenge) : new Response("Verificação inválida.", { status: 403 });
  },
  POST: async ({ request }) => {
    const raw = await request.text(); const signature = request.headers.get("x-hub-signature-256") || "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("whatsapp_operational_integrations" as any).select("app_secret,status").eq("status", "configured").maybeSingle();
    if (!data) return new Response("Integração inativa.", { status: 503 });
    const expected = `sha256=${createHmac("sha256", data.app_secret).update(raw).digest("hex")}`;
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return new Response("Assinatura inválida.", { status: 401 });
    // A entrada já é validada e recebida. Os comandos conversacionais serão ativados após o número oficial ser conectado.
    return new Response("EVENT_RECEIVED", { status: 200 });
  },
} } });

