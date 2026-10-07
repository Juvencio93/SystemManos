import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import QRCode from "qrcode";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPagBankErrorMessage } from "@/lib/pagbank-errors";

const api = (environment: string) => environment === "sandbox" ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
async function pagbank(token: string, environment: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
  };
  if (body) init.body = JSON.stringify(body);
  const r = await fetch(`${api(environment)}${path}`, init);
  const text = await r.text();
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })();
  if (!r.ok) throw new Error(getPagBankErrorMessage(json as any, r.status));
  return json;
}
const ownerScope = (query: any, ownerType: string, ownerId: string | null) => ownerId ? query.eq("owner_type", ownerType).eq("owner_id", ownerId) : query.eq("owner_type", ownerType).is("owner_id", null);

export const getOrCreatePagBankPix = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: unknown) => z.object({ chargeId: z.string().uuid() }).parse(input)).handler(async ({ context, data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role } = await context.supabase.from("user_roles").select("role, company_id, reseller_id").eq("user_id", context.userId).maybeSingle(); if (!role || !["adm", "matriz", "revenda"].includes(role.role)) throw new Error("Sem permissão para gerar pagamento.");
  const { data: charge, error } = await supabaseAdmin.from("company_charges").select("id, company_id, amount, reference, status, pagbank_order_id, companies(reseller_id, name, trade_name, document, contact_email, contact_phone)").eq("id", data.chargeId).maybeSingle(); if (error || !charge) throw new Error("Cobrança não encontrada."); if (charge.status === "pago") throw new Error("Esta cobrança já está paga.");
  const company = charge.companies as any; const resellerId = company?.reseller_id ?? null; if (role.role === "matriz" && role.company_id !== charge.company_id) throw new Error("Sem permissão para esta cobrança."); if (role.role === "revenda" && role.reseller_id !== resellerId) throw new Error("Sem permissão para esta cobrança.");
  const ownerType = resellerId ? "reseller" : "platform"; const ownerId = resellerId;
  const { data: pref } = await ownerScope(supabaseAdmin.from("payment_provider_preferences").select("provider"), ownerType, ownerId).maybeSingle(); if (pref?.provider !== "pagbank") return { available: false, provider: "pagbank" as const };
  const { data: integration } = await ownerScope(supabaseAdmin.from("pagbank_integrations" as any).select("access_token, environment, webhook_url, status"), ownerType, ownerId).maybeSingle(); if (!integration || integration.status !== "configured") return { available: false, provider: "pagbank" as const };
  if (!company?.document || !company?.contact_email) throw new Error("Para cobrar pelo PagBank, complete CPF/CNPJ e e-mail no cadastro da empresa.");
  if (charge.pagbank_order_id) { try { const order = await pagbank(integration.access_token, integration.environment, `/orders/${charge.pagbank_order_id}`); const stored = order?.charges?.[0]?.qr_code?.text; if (stored) { const dataUrl = await QRCode.toDataURL(stored, { margin: 1, width: 360 }); return { success: true, available: true, provider: "pagbank" as const, copyPaste: stored, qrCode: dataUrl.replace(/^data:image\/png;base64,/, "") }; } } catch { await supabaseAdmin.from("company_charges").update({ pagbank_order_id: null, pagbank_last_event_id: null, pix_payload: null, external_id: null, updated_at: new Date().toISOString() } as any).eq("id", charge.id); }
  }
  const phone = String(company.contact_phone || "").replace(/\D/g, ""); const expires = new Date(Date.now() + 86400000).toISOString();
  const order = await pagbank(integration.access_token, integration.environment, "/orders", { reference_id: charge.id, customer: { name: company.trade_name || company.name, email: company.contact_email, tax_id: String(company.document).replace(/\D/g, ""), ...(phone.length >= 10 ? { phones: [{ type: "MOBILE", country: "55", area: phone.slice(-11, -9), number: phone.slice(-9) }] } : {}) }, items: [{ reference_id: charge.id, name: charge.reference, quantity: 1, unit_amount: Math.round(Number(charge.amount) * 100) }], charges: [{ reference_id: charge.id, description: charge.reference, amount: { value: Math.round(Number(charge.amount) * 100), currency: "BRL" }, payment_method: { type: "PIX", pix: { expiration_date: expires } } }], notification_urls: [integration.webhook_url] });
  const pgCharge = order?.charges?.[0]; const copyPaste = pgCharge?.qr_code?.text; if (!order?.id || !copyPaste) throw new Error("O PagBank não retornou o QR Code PIX.");
  const { error: updateError } = await supabaseAdmin.from("company_charges").update({ status: "atrasado", payment_provider: "pagbank", pagbank_order_id: order.id, pagbank_last_event_id: null, pix_payload: copyPaste, external_id: order.id, method: "PIX PagBank", updated_at: new Date().toISOString() } as any).eq("id", charge.id); if (updateError) throw new Error(updateError.message);
  let qrCode: string | null = null;
  try { const dataUrl = await QRCode.toDataURL(copyPaste, { margin: 1, width: 360 }); qrCode = dataUrl.replace(/^data:image\/png;base64,/, ""); } catch { /* o copia e cola continua válido */ }
  return { success: true, available: true, provider: "pagbank" as const, qrCode, copyPaste };
});
