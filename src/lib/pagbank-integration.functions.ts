import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Owner = { ownerType: "platform" | "reseller"; ownerId: string | null; label: string };
const mask = (value: string | null | undefined) => !value ? null : `${value.slice(0, 6)}****${value.slice(-4)}`;
const baseUrl = (environment: "sandbox" | "production") => environment === "sandbox" ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
const siteUrl = (value?: string) => (value?.trim() || process.env["VITE_SITE_URL"]?.trim() || (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "")).replace(/\/+$/, "");

async function ownerFor(supabase: any, userId: string): Promise<Owner> {
  const { data, error } = await supabase.from("user_roles").select("role, reseller_id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Sem permissão para configurar o PagBank.");
  if (data.role === "adm") return { ownerType: "platform", ownerId: null, label: "Manos Tech" };
  if (data.role === "revenda" && data.reseller_id) return { ownerType: "reseller", ownerId: data.reseller_id, label: "sua revenda" };
  throw new Error("O PagBank está disponível apenas para ADM e Revendas.");
}
function scoped(query: any, owner: Owner) { const q = query.eq("owner_type", owner.ownerType); return owner.ownerId ? q.eq("owner_id", owner.ownerId) : q.is("owner_id", null); }
async function request(token: string, environment: "sandbox" | "production", path: string) {
  const response = await fetch(`${baseUrl(environment)}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_messages?.[0]?.description || payload?.message || `PagBank retornou erro ${response.status}.`);
  return payload;
}
async function requestWebhookPublicKey(token: string, environment: "sandbox" | "production") {
  try { return await request(token, environment, "/public-keys?type=webhook"); }
  catch { return await request(token, environment, "/public-keys/webhook"); }
}

export const getPagBankIntegration = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const owner = await ownerFor(context.supabase, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await scoped(supabaseAdmin.from("pagbank_integrations" as any).select("id, access_token, environment, webhook_url, status, last_tested_at, last_error"), owner).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { configured: data.status !== "disabled", status: data.status, tokenMasked: mask(data.access_token), environment: data.environment, webhookUrl: data.webhook_url, lastTestedAt: data.last_tested_at, lastError: data.last_error, ownerLabel: owner.label } : { configured: false, status: "not_configured", ownerLabel: owner.label };
});

export const savePagBankIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: unknown) => z.object({ accessToken: z.string().trim().min(12, "Informe o token PagBank."), environment: z.enum(["sandbox", "production"]), siteUrl: z.string().trim().url().optional().or(z.literal("")) }).parse(input)).handler(async ({ context, data }) => {
  const owner = await ownerFor(context.supabase, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const url = siteUrl(data.siteUrl);
  if (!url || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) throw new Error("Informe a URL pública publicada do sistema.");
  await requestWebhookPublicKey(data.accessToken, data.environment);
  const webhookUrl = `${url}/api/public/pagbank-webhook-v1`; const now = new Date().toISOString();
  const { data: existing, error: findError } = await scoped(supabaseAdmin.from("pagbank_integrations" as any).select("id"), owner).maybeSingle(); if (findError) throw new Error(findError.message);
  const payload = { owner_type: owner.ownerType, owner_id: owner.ownerId, access_token: data.accessToken, environment: data.environment, webhook_url: webhookUrl, status: "configured", last_tested_at: now, last_error: null, updated_at: now };
  const { error } = existing ? await supabaseAdmin.from("pagbank_integrations" as any).update(payload).eq("id", existing.id) : await supabaseAdmin.from("pagbank_integrations" as any).insert(payload); if (error) throw new Error(error.message);
  return { success: true, configured: true, tokenMasked: mask(data.accessToken), webhookUrl };
});

export const testPagBankIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const owner = await ownerFor(context.supabase, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { data: integration, error } = await scoped(supabaseAdmin.from("pagbank_integrations" as any).select("id, access_token, environment"), owner).maybeSingle(); if (error || !integration) throw new Error("Integração PagBank ainda não configurada."); const now = new Date().toISOString();
  try { await requestWebhookPublicKey(integration.access_token, integration.environment); await supabaseAdmin.from("pagbank_integrations" as any).update({ status: "configured", last_tested_at: now, last_error: null, updated_at: now }).eq("id", integration.id); return { success: true }; }
  catch (cause) { const message = cause instanceof Error ? cause.message : "Falha ao testar PagBank."; await supabaseAdmin.from("pagbank_integrations" as any).update({ status: "error", last_tested_at: now, last_error: message, updated_at: now }).eq("id", integration.id); throw new Error(message); }
});
export const removePagBankIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { const owner = await ownerFor(context.supabase, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const { error } = await scoped(supabaseAdmin.from("pagbank_integrations" as any).update({ status: "disabled", updated_at: new Date().toISOString() }), owner); if (error) throw new Error(error.message); return { success: true }; });
