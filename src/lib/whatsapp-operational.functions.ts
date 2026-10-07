import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdm(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (data?.role !== "adm") throw new Error("Somente o ADM pode configurar o WhatsApp Operacional.");
}
const mask = (value?: string | null) => value ? `${value.slice(0, 6)}****${value.slice(-4)}` : null;

export const getWhatsAppOperationalIntegration = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdm(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("whatsapp_operational_integrations" as any).select("waba_id,phone_number_id,business_phone,alert_phone,access_token,verify_token,alert_template_name,status,last_error").maybeSingle();
  return data ? { configured: data.status === "configured", saved: data.status !== "disabled", ...data, access_token: undefined, verify_token: undefined, verifyTokenMasked: mask(data.verify_token), tokenMasked: mask(data.access_token), last_error: data.last_error?.includes("131030") ? "O número que receberá os alertas ainda não foi autorizado na lista de destinatários de teste da Meta." : data.last_error } : { configured: false, saved: false };
});

export const saveWhatsAppOperationalIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: unknown) => z.object({ wabaId: z.string().trim().min(5), phoneNumberId: z.string().trim().min(5), businessPhone: z.string().trim().min(10), alertPhone: z.string().trim().min(10), accessToken: z.string().trim().min(20), appSecret: z.string().trim().min(20), templateName: z.string().trim().min(3).default("alerta_operacional") }).parse(input)).handler(async ({ context, data }) => {
  await requireAdm(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.from("whatsapp_operational_integrations" as any).select("id,verify_token").maybeSingle();
  const payload = { waba_id: data.wabaId, phone_number_id: data.phoneNumberId, business_phone: data.businessPhone, alert_phone: data.alertPhone, access_token: data.accessToken, app_secret: data.appSecret, verify_token: existing?.verify_token || crypto.randomUUID().replaceAll("-", ""), alert_template_name: data.templateName, status: "configured", last_error: null, updated_at: new Date().toISOString() };
  const result = existing ? await supabaseAdmin.from("whatsapp_operational_integrations" as any).update(payload).eq("id", existing.id) : await supabaseAdmin.from("whatsapp_operational_integrations" as any).insert(payload);
  if (result.error) throw new Error(result.error.message);
  return { success: true, verifyToken: payload.verify_token };
});

export const testWhatsAppOperationalIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdm(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendOperationalWhatsAppAlert } = await import("@/lib/whatsapp-operational.server");
  const result = await sendOperationalWhatsAppAlert(supabaseAdmin, { title: "Teste do Gerente Operacional IA", description: "A integração com o WhatsApp está funcionando." });
  if (!result.sent) throw new Error(result.message || "WhatsApp Operacional ainda não configurado.");
  return { success: true };
});

export const removeWhatsAppOperationalIntegration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdm(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("whatsapp_operational_integrations" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(error.message);
  return { success: true };
});

