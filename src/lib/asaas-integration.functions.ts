import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ASAAS_EVENTS = [
  "PAYMENT_CREATED",
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
] as const;

const ASAAS_USER_AGENT = "ManosTech/1.0 (Asaas API; server)";

type AsaasEnvironment = "production" | "sandbox";

type AsaasWebhook = {
  id?: string;
  name?: string;
  url?: string;
  events?: string[];
};

function isMissingIntegrationTable(error: unknown) {
  const source =
    error && typeof error === "object"
      ? [
          (error as { message?: unknown }).message,
          (error as { details?: unknown }).details,
          (error as { hint?: unknown }).hint,
          (error as { code?: unknown }).code,
          JSON.stringify(error),
        ]
          .filter(Boolean)
          .join(" ")
      : String(error || "");

  const message = source.toLowerCase();
  return (
    message.includes("asaas_integrations") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the table") ||
      message.includes("pgrst205"))
  );
}

function missingIntegrationTableError() {
  return new Error(
    "A estrutura da integração Asaas ainda não foi aplicada no banco. Publique/aplique as migrations do projeto e tente novamente.",
  );
}

function getAsaasApiUrl(environment: AsaasEnvironment) {
  return environment === "sandbox"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}****${value.slice(-2)}`;
  return `${value.slice(0, 6)}****${value.slice(-4)}`;
}

function createWebhookToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function resolveSiteUrl(inputUrl?: string) {
  const provided = inputUrl?.trim();
  if (provided) return provided.replace(/\/+$/, "");

  const explicit = process.env["VITE_SITE_URL"]?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env["VERCEL_URL"]?.trim();
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/+$/, "");

  const lovableUrl = process.env["LOVABLE_SITE_URL"]?.trim();
  if (lovableUrl) return lovableUrl.replace(/\/+$/, "");

  return "";
}

type AsaasOwner = { ownerType: "platform"; ownerId: null; label: string } | { ownerType: "reseller"; ownerId: string; label: string };

async function resolveAsaasOwner(supabase: any, userId: string): Promise<AsaasOwner> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, reseller_id")
    .eq("user_id", userId)
    .maybeSingle();

  const roleData = data as { role?: string | null; reseller_id?: string | null } | null;
  if (error || !roleData) throw new Error("Sem permissão para configurar a integração Asaas.");
  if (roleData.role === "adm") return { ownerType: "platform", ownerId: null, label: "Manos Tech" };
  if (roleData.role === "revenda" && roleData.reseller_id) {
    return { ownerType: "reseller", ownerId: roleData.reseller_id, label: "sua revenda" };
  }
  throw new Error("A integração Asaas está disponível apenas para ADM e Revendas.");
}

function applyOwnerFilter(query: any, owner: AsaasOwner) {
  const scoped = query.eq("owner_type", owner.ownerType);
  return owner.ownerId ? scoped.eq("owner_id", owner.ownerId) : scoped.is("owner_id", null);
}

async function fetchAsaas({
  accessToken,
  environment,
  endpoint,
  options = {},
}: {
  accessToken: string;
  environment: AsaasEnvironment;
  endpoint: string;
  options?: RequestInit;
}) {
  const response = await fetch(`${getAsaasApiUrl(environment)}${endpoint}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "Content-Type": "application/json",
      "User-Agent": ASAAS_USER_AGENT,
      access_token: accessToken,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.description ||
      payload?.message ||
      `Asaas retornou erro ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

async function findAsaasWebhook({
  accessToken,
  environment,
  webhookUrl,
}: {
  accessToken: string;
  environment: AsaasEnvironment;
  webhookUrl: string;
}) {
  const response = await fetchAsaas({
    accessToken,
    environment,
    endpoint: "/webhooks?limit=100",
  });

  const webhooks = Array.isArray(response?.data) ? (response.data as AsaasWebhook[]) : [];
  return (
    webhooks.find((webhook) => webhook.url === webhookUrl) ||
    webhooks.find((webhook) => webhook.name === "Manos Tech - pagamentos") ||
    null
  );
}

async function upsertAsaasWebhook({
  accessToken,
  environment,
  webhookId,
  webhookUrl,
  payload,
}: {
  accessToken: string;
  environment: AsaasEnvironment;
  webhookId?: string | null;
  webhookUrl: string;
  payload: Record<string, unknown>;
}) {
  const updateWebhook = (id: string) =>
    fetchAsaas({
      accessToken,
      environment,
      endpoint: `/webhooks/${id}`,
      options: {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    });

  if (webhookId) {
    try {
      return await updateWebhook(webhookId);
    } catch {
      // The webhook saved locally may have been removed in Asaas. Fall back to discovery/creation.
    }
  }

  const existingWebhook = await findAsaasWebhook({ accessToken, environment, webhookUrl });
  if (existingWebhook?.id) {
    return updateWebhook(existingWebhook.id);
  }

  try {
    return await fetchAsaas({
      accessToken,
      environment,
      endpoint: "/webhooks",
      options: {
        method: "POST",
        body: JSON.stringify(payload),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("já existe") && !message.includes("ja existe")) {
      throw error;
    }

    const duplicatedWebhook = await findAsaasWebhook({ accessToken, environment, webhookUrl });
    if (duplicatedWebhook?.id) {
      return updateWebhook(duplicatedWebhook.id);
    }

    throw error;
  }
}

export const getAsaasIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const owner = await resolveAsaasOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await applyOwnerFilter(supabaseAdmin
      .from("asaas_integrations")
      .select("id, owner_type, environment, access_token, pix_key, webhook_id, webhook_url, notification_email, status, last_tested_at, last_error, updated_at"), owner).maybeSingle();

    if (error) {
      if (isMissingIntegrationTable(error)) {
        return {
          configured: false,
          environment: "production" as AsaasEnvironment,
          status: "missing_table",
          migrationRequired: true,
        };
      }
      throw new Error(error.message);
    }

    if (!data) {
      return {
        configured: false,
        environment: "production" as AsaasEnvironment,
        status: "not_configured",
      };
    }

    return {
      configured: data.status !== "disabled",
      environment: data.environment as AsaasEnvironment,
      accessTokenMasked: maskSecret(data.access_token),
      pixKeyMasked: maskSecret(data.pix_key),
      webhookId: data.webhook_id,
      webhookUrl: data.webhook_url,
      notificationEmail: data.notification_email,
      status: data.status,
      lastTestedAt: data.last_tested_at,
      lastError: data.last_error,
      updatedAt: data.updated_at,
      ownerLabel: owner.label,
    };
  });

export const saveAsaasIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        accessToken: z.string().trim().min(12, "Informe a chave de API da Asaas."),
        pixKey: z.string().trim().min(8, "Informe a chave Pix aleatória."),
        notificationEmail: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
        environment: z.enum(["production", "sandbox"]).default("production"),
        siteUrl: z.string().trim().url("Informe uma URL pública válida.").optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const owner = await resolveAsaasOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await fetchAsaas({
      accessToken: data.accessToken,
      environment: data.environment,
      endpoint: "/customers?limit=1",
    });

    const siteUrl = resolveSiteUrl(data.siteUrl);
    if (!siteUrl) {
      throw new Error(
        "URL pública do sistema não configurada. Informe a URL pública do sistema para criar o webhook automaticamente.",
      );
    }

    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(siteUrl)) {
      throw new Error(
        "A URL pública do sistema não pode ser localhost. Use a URL publicada, como https://manostech.lovable.app.",
      );
    }

    const { data: existing, error: existingError } = await applyOwnerFilter(supabaseAdmin
      .from("asaas_integrations")
      .select("id, webhook_id, webhook_token"), owner).maybeSingle();

    if (existingError) {
      if (isMissingIntegrationTable(existingError)) throw missingIntegrationTableError();
      throw new Error(existingError.message);
    }

    const webhookToken = existing?.webhook_token || createWebhookToken();
    const webhookUrl = `${siteUrl}/api/public/asaas-webhook-v2`;
    const webhookPayload = {
      name: `Manos Tech - pagamentos (${owner.label})`,
      url: webhookUrl,
      email: data.notificationEmail || "financeiro@manostech.com.br",
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: webhookToken,
      sendType: "SEQUENTIALLY",
      events: ASAAS_EVENTS,
    };

    const webhook = await upsertAsaasWebhook({
      accessToken: data.accessToken,
      environment: data.environment,
      webhookId: existing?.webhook_id ?? null,
      webhookUrl,
      payload: webhookPayload,
    });

    const now = new Date().toISOString();
    const payload = {
        owner_type: owner.ownerType,
        owner_id: owner.ownerId,
        environment: data.environment,
        access_token: data.accessToken,
        pix_key: data.pixKey,
        webhook_token: webhookToken,
        webhook_id: webhook?.id || null,
        webhook_url: webhookUrl,
        notification_email: data.notificationEmail || null,
        status: "configured",
        last_tested_at: now,
        last_error: null,
        updated_at: now,
    };

    const { error } = existing
      ? await supabaseAdmin.from("asaas_integrations").update(payload).eq("id", existing.id)
      : await supabaseAdmin.from("asaas_integrations").insert(payload);

    if (error) {
      if (isMissingIntegrationTable(error)) throw missingIntegrationTableError();
      throw new Error(error.message);
    }

    return {
      success: true,
      configured: true,
      accessTokenMasked: maskSecret(data.accessToken),
      pixKeyMasked: maskSecret(data.pixKey),
      webhookId: webhook?.id || null,
      webhookUrl,
    };
  });

export const testAsaasIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const owner = await resolveAsaasOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integration, error } = await applyOwnerFilter(supabaseAdmin
      .from("asaas_integrations")
      .select("id, access_token, environment"), owner).maybeSingle();

    if (error) {
      if (isMissingIntegrationTable(error)) throw missingIntegrationTableError();
      throw new Error(error.message);
    }
    if (!integration) throw new Error("Integração Asaas ainda não configurada.");

    const now = new Date().toISOString();
    try {
      await fetchAsaas({
        accessToken: integration.access_token,
        environment: integration.environment as AsaasEnvironment,
        endpoint: "/customers?limit=1",
      });

      await supabaseAdmin
        .from("asaas_integrations")
        .update({ status: "configured", last_tested_at: now, last_error: null, updated_at: now })
        .eq("id", integration.id);

      return { success: true, testedAt: now };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao testar Asaas.";
      await supabaseAdmin
        .from("asaas_integrations")
        .update({ status: "error", last_tested_at: now, last_error: message, updated_at: now })
        .eq("id", integration.id);
      throw new Error(message);
    }
  });

export const removeAsaasIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const owner = await resolveAsaasOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await applyOwnerFilter(
      supabaseAdmin
        .from("asaas_integrations")
        .update({ status: "disabled", updated_at: new Date().toISOString() }),
      owner,
    );

    if (error) {
      if (isMissingIntegrationTable(error)) throw missingIntegrationTableError();
      throw new Error(error.message);
    }
    return { success: true };
  });
