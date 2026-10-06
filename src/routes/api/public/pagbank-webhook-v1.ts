import { createFileRoute } from "@tanstack/react-router";
import { createPublicKey, verify } from "node:crypto";

const api = (environment: string) => environment === "sandbox" ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
function pem(base64: string) { const body = base64.match(/.{1,64}/g)?.join("\n") ?? base64; return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`; }
async function signatureValid(raw: string, signature: string, token: string, environment: string) {
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  let response = await fetch(`${api(environment)}/public-keys?type=webhook`, { headers });
  let data = await response.json().catch(() => ({}));
  if (!response.ok || !data.public_key) {
    response = await fetch(`${api(environment)}/public-keys/webhook`, { headers });
    data = await response.json().catch(() => ({}));
  }
  if (!response.ok || !data.public_key) return false;
  try { return verify("sha256", Buffer.from(raw, "utf8"), createPublicKey(pem(data.public_key)), Buffer.from(signature, "base64")); } catch { return false; }
}
export const Route = createFileRoute("/api/public/pagbank-webhook-v1")({ server: { handlers: { POST: async ({ request }) => {
  const raw = await request.text(); const signature = request.headers.get("x-payload-signature"); if (!signature) return new Response("Assinatura ausente.", { status: 400 });
  try { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { data: integrations, error } = await supabaseAdmin.from("pagbank_integrations" as any).select("access_token, environment").eq("status", "configured"); if (error) throw error; const valid = await Promise.all((integrations ?? []).map((i: any) => signatureValid(raw, signature, i.access_token, i.environment))); if (!valid.some(Boolean)) return new Response("Assinatura inválida.", { status: 401 });
    const payload = JSON.parse(raw) as any; const orderId = payload?.id; const pgCharge = payload?.charges?.[0]; if (!orderId || !pgCharge?.id) return new Response("Evento ignorado.", { status: 200 }); const { data: charge } = await supabaseAdmin.from("company_charges").select("id, status, pagbank_last_event_id").eq("pagbank_order_id", orderId).maybeSingle(); if (!charge || charge.pagbank_last_event_id === pgCharge.id) return new Response("OK", { status: 200 }); const paid = pgCharge.status === "PAID"; const failed = ["DECLINED", "CANCELED"].includes(pgCharge.status); if (paid || failed) { const { error: updateError } = await supabaseAdmin.from("company_charges").update({ status: paid ? "pago" : "atrasado", paid_at: paid ? new Date().toISOString() : null, pagbank_last_event_id: pgCharge.id, updated_at: new Date().toISOString() } as any).eq("id", charge.id); if (updateError) throw updateError; } return new Response("OK", { status: 200 });
  } catch (error) { console.error("[pagbank-webhook-v1] processing failure", error); return new Response("Erro interno.", { status: 500 }); }
} } } });
