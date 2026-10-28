import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitPreSaleSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().max(24).optional().default(""),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(32),
  city: z.string().trim().max(100).optional().default(""),
  summary: z.string().trim().min(20).max(3000),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
});

const statusSchema = z.enum(["novo", "em_andamento", "convertido", "encerrado"]);

export type PreSaleRecord = {
  id: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string;
  email: string;
  phone: string;
  city: string | null;
  summary: string;
  status: "novo" | "em_andamento" | "convertido" | "encerrado";
  viewed_at: string | null;
  telegram_status: "pendente" | "enviado" | "erro" | "nao_configurado";
  telegram_error: string | null;
  created_at: string;
};

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "adm")
    .maybeSingle();

  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

async function getRequestIpHash() {
  const request = getRequest();
  const forwardedFor = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || request?.headers.get("x-real-ip")?.trim() || "unknown";
  const secret = process.env["TECH_SUPABASE_SERVICE_KEY"];
  if (!secret || ip === "unknown") return null;
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

type PreSaleNotification = {
  id: string;
  company_name: string;
  cnpj: string | null;
  contact_name: string;
  email: string;
  phone: string;
  city: string | null;
  summary: string;
  created_at: string;
};

async function createAdminPreSaleNotifications(adminDb: any, preSale: PreSaleNotification, retry = false) {
  const { data: admins, error: adminsError } = await adminDb
    .from("user_roles")
    .select("user_id")
    .eq("role", "adm");
  if (adminsError || !admins?.length) {
    console.error("[PreSale] No admin recipients available for system notification.", adminsError?.message);
    return { status: "erro" as const, error: "Não foi possível localizar os administradores." };
  }

  const { data: telegramIntegration } = await adminDb
    .from("telegram_operational_integrations")
    .select("status")
    .in("status", ["configured", "error"])
    .limit(1)
    .maybeSingle();

  const summary = preSale.summary.replace(/\s+/g, " ").trim();
  const description = [
    `Empresa: ${preSale.company_name}${preSale.cnpj ? ` · CNPJ ${preSale.cnpj}` : ""}`,
    `Contato: ${preSale.contact_name}`,
    `WhatsApp: ${preSale.phone}`,
    `E-mail: ${preSale.email}`,
    preSale.city ? `Cidade: ${preSale.city}` : null,
    summary ? `Necessidade: ${summary.slice(0, 900)}${summary.length > 900 ? "…" : ""}` : null,
  ].filter(Boolean).join("\n");

  const notifications = admins.map((admin: { user_id: string }) => ({
    recipient_user_id: admin.user_id,
    event_key: retry
      ? `pre_sale:${preSale.id}:${admin.user_id}:${Date.now()}`
      : `pre_sale:${preSale.id}:${admin.user_id}`,
    category: "pre_venda",
    severity: "success",
    title: retry ? "Reenvio da solicitação de pré-venda" : "Nova solicitação de pré-venda",
    description,
    company_id: null,
  }));
  const { error: notificationError } = await adminDb.from("system_notifications").insert(notifications);
  if (notificationError) {
    console.error("[PreSale] Could not create admin system notification:", notificationError.message);
    return { status: "erro" as const, error: "Solicitação salva, mas o aviso do sistema falhou." };
  }

  return telegramIntegration
    ? { status: "pendente" as const, error: null }
    : { status: "nao_configurado" as const, error: "Integração do Telegram não configurada." };
}

export const submitPreSale = createServerFn({ method: "POST" })
  .validator((input: unknown) => submitPreSaleSchema.parse(input))
  .handler(async ({ data }) => {
    // A honeypot keeps automated submissions from creating records.
    if (data.website) throw new Error("Não foi possível enviar sua solicitação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const ipHash = await getRequestIpHash();

    if (ipHash) {
      const { count, error: rateError } = await adminDb
        .from("pre_sales")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      if (rateError) throw new Error("Não foi possível validar o envio. Tente novamente em instantes.");
      if ((count ?? 0) >= 3) throw new Error("Você já enviou solicitações recentemente. Aguarde alguns minutos.");
    }

    const { data: saved, error } = await adminDb
      .from("pre_sales")
      .insert({
        company_name: data.companyName,
        cnpj: normalizeOptional(data.cnpj),
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone,
        city: normalizeOptional(data.city),
        summary: data.summary,
        ip_hash: ipHash,
      })
      .select("id, company_name, cnpj, contact_name, email, phone, city, summary, created_at")
      .single();

    if (error || !saved) {
      console.error("[PreSale] Could not persist submission:", error?.message);
      throw new Error("Não foi possível registrar sua solicitação agora. Tente novamente.");
    }

    const telegram = await createAdminPreSaleNotifications(adminDb, saved);
    const { error: notificationError } = await adminDb
      .from("pre_sales")
      .update({
        telegram_status: telegram.status,
        telegram_error: telegram.error,
        telegram_attempted_at: new Date().toISOString(),
      })
      .eq("id", saved.id);
    if (notificationError) console.error("[PreSale] Could not record Telegram delivery:", notificationError.message);

    return { success: true as const, id: saved.id };
  });

const savePreSalePartialSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(32),
  website: z.string().max(0).optional().default(""),
});

// O contato é salvo já no primeiro passo do balão: se o visitante parar
// no meio, a equipe já tem o WhatsApp e pode chamar de volta. Não dispara
// aviso: o aviso (sistema + Telegram) só sai na conclusão, com consentimento.
export const savePreSalePartial = createServerFn({ method: "POST" })
  .validator((input: unknown) => savePreSalePartialSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Não foi possível registrar sua solicitação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const ipHash = await getRequestIpHash();

    if (ipHash) {
      const { count, error: rateError } = await adminDb
        .from("pre_sales")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
      if (rateError) throw new Error("Não foi possível validar o envio. Tente novamente em instantes.");
      if ((count ?? 0) >= 3) throw new Error("Você já enviou solicitações recentemente. Aguarde alguns minutos.");
    }

    const { data: saved, error } = await adminDb
      .from("pre_sales")
      .insert({
        company_name: data.companyName,
        contact_name: data.contactName,
        phone: data.phone,
        email: "",
        summary: "",
        ip_hash: ipHash,
      })
      .select("id")
      .single();

    if (error || !saved) {
      console.error("[PreSale] Could not persist partial submission:", error?.message);
      throw new Error("Não foi possível registrar sua solicitação agora. Tente novamente.");
    }

    return { success: true as const, id: saved.id };
  });

const completePreSaleSchema = z.object({
  id: z.string().uuid(),
  email: z.union([z.string().trim().email().max(160), z.literal("")]).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  summary: z.string().trim().max(3000).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
});

// Conclui um lead parcial: preenche os campos do passo 2, registra o
// consentimento e só então dispara o aviso (sistema + Telegram). O id é um
// uuid aleatório e a conclusão só acontece uma vez: se já houver aviso
// registrado para o lead, o envio é recusado.
export const completePreSale = createServerFn({ method: "POST" })
  .validator((input: unknown) => completePreSaleSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) throw new Error("Não foi possível enviar sua solicitação.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;

    const { data: existing, error: fetchError } = await adminDb
      .from("pre_sales")
      .select("id, company_name, cnpj, contact_name, email, phone, city, summary, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError || !existing) throw new Error("Não foi possível localizar esta solicitação. Recomece o atendimento.");

    const { data: notified } = await adminDb
      .from("system_notifications")
      .select("id")
      .like("event_key", `pre_sale:${data.id}:%`)
      .limit(1);
    if (notified?.length) throw new Error("Esta solicitação já foi enviada.");

    const { data: saved, error: updateError } = await adminDb
      .from("pre_sales")
      .update({
        email: data.email,
        city: normalizeOptional(data.city),
        summary: data.summary,
        consented_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id, company_name, cnpj, contact_name, email, phone, city, summary, created_at")
      .single();

    if (updateError || !saved) {
      console.error("[PreSale] Could not complete submission:", updateError?.message);
      throw new Error("Não foi possível concluir o envio. Tente novamente.");
    }

    const telegram = await createAdminPreSaleNotifications(adminDb, saved);
    const { error: notificationError } = await adminDb
      .from("pre_sales")
      .update({
        telegram_status: telegram.status,
        telegram_error: telegram.error,
        telegram_attempted_at: new Date().toISOString(),
      })
      .eq("id", saved.id);
    if (notificationError) console.error("[PreSale] Could not record Telegram delivery:", notificationError.message);

    return { success: true as const, id: saved.id };
  });

export const getPreSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const { data, error } = await adminDb
      .from("pre_sales")
      .select("id, company_name, cnpj, contact_name, email, phone, city, summary, status, viewed_at, telegram_status, telegram_error, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Não foi possível carregar a caixa de pré-vendas.");

    const { data: deliveries, error: deliveryError } = await adminDb
      .from("telegram_operational_deliveries")
      .select("event_key, status, last_error, created_at")
      .like("event_key", "pre_sale:%")
      .order("created_at", { ascending: false })
      .limit(500);
    const deliveryByLead = new Map<string, { status: string; error: string | null }>();
    if (!deliveryError) {
      for (const delivery of deliveries ?? []) {
        const leadId = String(delivery.event_key).split(":")[1];
        if (!leadId || deliveryByLead.has(leadId)) continue;
        deliveryByLead.set(leadId, { status: delivery.status, error: delivery.last_error ?? null });
      }
    }

    const viewedAt = new Date().toISOString();
    const { error: viewError } = await adminDb
      .from("pre_sales")
      .update({ viewed_at: viewedAt })
      .is("viewed_at", null);
    if (viewError) throw new Error("Não foi possível atualizar o aviso de novas solicitações.");
    return (data ?? []).map((item: any) => {
      const delivery = deliveryByLead.get(item.id);
      const telegramStatus = delivery
        ? delivery.status === "sent" ? "enviado" : delivery.status === "failed" ? "erro" : "pendente"
        : item.telegram_status;
      return {
        ...item,
        viewed_at: item.viewed_at ?? viewedAt,
        telegram_status: telegramStatus,
        telegram_error: delivery?.error ?? item.telegram_error,
      };
    }) as PreSaleRecord[];
  });

export const getUnreadPreSalesCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const { count, error } = await adminDb
      .from("pre_sales")
      .select("id", { count: "exact", head: true })
      .is("viewed_at", null);
    if (error) throw new Error("Não foi possível consultar as novas solicitações.");
    return { count: count ?? 0 };
  });

export const updatePreSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid(), status: statusSchema }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const { error } = await adminDb
      .from("pre_sales")
      .update({ status: data.status, viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível atualizar esta solicitação.");
    return { success: true as const };
});

export const retryPreSaleTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const adminDb: any = supabaseAdmin;
    const { data: preSale, error } = await adminDb
      .from("pre_sales")
      .select("id, company_name, cnpj, contact_name, email, phone, city, summary, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !preSale) throw new Error("Não foi possível localizar esta solicitação.");

    const telegram = await createAdminPreSaleNotifications(adminDb, preSale, true);
    const { error: updateError } = await adminDb
      .from("pre_sales")
      .update({
        telegram_status: telegram.status,
        telegram_error: telegram.error,
        telegram_attempted_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updateError) throw new Error("O Telegram foi tentado, mas não foi possível registrar o resultado.");
    return telegram;
  });

