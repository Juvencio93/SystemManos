import { createServerFn } from "@tanstack/react-start";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const targetSchema = z.object({
  kind: z.enum(["company", "branch"]),
  targetId: z.string().uuid(),
});

export const getMikrotikActivationDownload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let deviceQuery = (supabaseAdmin as any).from("hotspot_devices").select("router_identity").eq("company_id", scope.companyId);
    deviceQuery = scope.branchId ? deviceQuery.eq("branch_id", scope.branchId) : deviceQuery.is("branch_id", null);
    const { data: device } = await deviceQuery.maybeSingle();
    const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"]?.trim();
    if (!device?.router_identity || !secret) throw new Error("Ativação personalizada indisponível.");
    const exp = String(Date.now() + 10 * 60 * 1000);
    const sig = createHmac("sha256", secret).update(`${device.router_identity}.${exp}`).digest("hex");
    return `/api/internal/mikrotik-activation?router=${encodeURIComponent(device.router_identity)}&exp=${exp}&sig=${sig}`;
  });

const nullableText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || null);

const nullablePositiveInteger = (minimum: number, maximum: number) =>
  z
    .number()
    .int()
    .min(minimum)
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const saveSchema = targetSchema.extend({
  vendor: z.enum(["test", "mikrotik_hotspot", "intelbras_zeus", "intelbras_hotspot300_legacy"]),
  displayName: nullableText,
  ssid: nullableText,
  apMac: nullableText,
  integrationMode: nullableText,
  sessionTimeoutSeconds: nullablePositiveInteger(60, 86400),
  idleTimeoutSeconds: nullablePositiveInteger(60, 86400),
  downloadKbps: nullablePositiveInteger(64, 1000000),
  uploadKbps: nullablePositiveInteger(64, 1000000),
  limitSource: z.enum(["equipment", "system"]),
  routerIdentity: z.string().trim().regex(/^MT-[A-Z0-9-]{6,48}$/).optional().or(z.literal("")),
});

type HotspotConfigRow = Database["public"]["Tables"]["hotspot_configs"]["Row"];
type UserRoleRow = Pick<
  Database["public"]["Tables"]["user_roles"]["Row"],
  "role" | "company_id" | "branch_id" | "reseller_id"
>;

const ROLE_PRIORITY = ["adm", "matriz", "filial", "revenda"] as const;

async function resolveScope(
  userId: string,
  target: z.infer<typeof targetSchema>,
): Promise<{ companyId: string; branchId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let companyId = target.targetId;
  let branchId: string | null = null;
  let targetResellerId: string | null = null;

  if (target.kind === "company") {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .select("id, reseller_id")
      .eq("id", target.targetId)
      .maybeSingle();
    if (error || !company) throw new Error("Matriz não encontrada.");
    targetResellerId = company.reseller_id;
  } else {
    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .select("id, company_id, reseller_id")
      .eq("id", target.targetId)
      .maybeSingle();
    if (error || !branch) throw new Error("Filial não encontrada.");
    companyId = branch.company_id;
    branchId = branch.id;
    targetResellerId = branch.reseller_id;
    if (!targetResellerId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("reseller_id")
        .eq("id", branch.company_id)
        .maybeSingle();
      targetResellerId = company?.reseller_id ?? null;
    }
  }

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role, company_id, branch_id, reseller_id")
    .eq("user_id", userId);
  if (rolesError) throw new Error("Não foi possível validar as permissões.");

  const primaryRole = ([...(roles ?? [])] as UserRoleRow[]).sort(
    (a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role),
  )[0];

  if (!primaryRole) throw new Error("Usuário sem perfil de acesso configurado.");

  const allowed =
    primaryRole.role === "adm" ||
    (primaryRole.role === "matriz" && primaryRole.company_id === companyId) ||
    (primaryRole.role === "revenda" &&
      Boolean(primaryRole.reseller_id) &&
      primaryRole.reseller_id === targetResellerId);

  if (!allowed) {
    throw new Error("Sem permissão para gerenciar este equipamento.");
  }

  return { companyId, branchId };
}

function toPublicConfig(row: HotspotConfigRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    vendor: row.vendor,
    displayName: row.display_name,
    ssid: row.ssid,
    apMac: row.ap_mac,
    integrationMode: row.integration_mode,
    status: row.status,
    sessionTimeoutSeconds: row.session_timeout_seconds,
    idleTimeoutSeconds: row.idle_timeout_seconds,
    downloadKbps: row.download_kbps,
    uploadKbps: row.upload_kbps,
    limitSource: row.limit_source,
    isActive: row.is_active,
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
  };
}

export const getHotspotConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("hotspot_configs")
      .select(
        "id, vendor, display_name, ssid, ap_mac, integration_mode, status, session_timeout_seconds, idle_timeout_seconds, download_kbps, upload_kbps, limit_source, is_active, last_tested_at, last_test_status",
      )
      .eq("company_id", scope.companyId);
    query = scope.branchId ? query.eq("branch_id", scope.branchId) : query.is("branch_id", null);

    const { data: config, error } = await query.maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração do equipamento.");
    return { config: toPublicConfig(config as HotspotConfigRow | null) };
  });

/** Creates the non-secret identity used by the universal MikroTik login.html. */
export const getMikrotikProvisioning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let configQuery = supabaseAdmin
      .from("hotspot_configs")
      .select("id, vendor")
      .eq("company_id", scope.companyId);
    configQuery = scope.branchId ? configQuery.eq("branch_id", scope.branchId) : configQuery.is("branch_id", null);
    const { data: config } = await configQuery.maybeSingle();
    if (!config || !["mikrotik_hotspot", "mikrotik"].includes(config.vendor)) {
      throw new Error("Salve primeiro uma configuração MikroTik para esta unidade.");
    }

    const { data: existing } = await (supabaseAdmin as any)
      .from("hotspot_devices")
      .select("router_identity, status")
      .eq("hotspot_config_id", config.id)
      .maybeSingle();
    if (existing) return { routerIdentity: existing.router_identity as string, status: existing.status as string };

    const routerIdentity = `MT-${randomBytes(6).toString("hex").toUpperCase()}`;
    const { data: device, error } = await (supabaseAdmin as any)
      .from("hotspot_devices")
      .insert({
        hotspot_config_id: config.id,
        company_id: scope.companyId,
        branch_id: scope.branchId,
        router_identity: routerIdentity,
        status: "awaiting_provisioning",
      })
      .select("router_identity, status")
      .single();
    if (error || !device) throw new Error("Não foi possível gerar a identidade do equipamento.");
    return { routerIdentity: device.router_identity as string, status: device.status as string };
  });

export const saveHotspotConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const statusByVendor = {
      test: "simulation_only",
      mikrotik_hotspot: "awaiting_homologation",
      intelbras_zeus: "awaiting_homologation",
      intelbras_hotspot300_legacy: "awaiting_homologation",
    } as const;

    const record: Database["public"]["Tables"]["hotspot_configs"]["Insert"] = {
      company_id: scope.companyId,
      branch_id: scope.branchId,
      vendor: data.vendor,
      display_name: data.displayName,
      ssid: data.ssid,
      ap_mac: data.apMac,
      integration_mode: data.integrationMode,
      status: statusByVendor[data.vendor],
      session_timeout_seconds: data.sessionTimeoutSeconds,
      idle_timeout_seconds: data.idleTimeoutSeconds,
      download_kbps: data.downloadKbps,
      upload_kbps: data.uploadKbps,
      limit_source: data.limitSource,
      config: {},
      is_active: false,
      updated_at: new Date().toISOString(),
    };

    let existingQuery = supabaseAdmin
      .from("hotspot_configs")
      .select("id, vendor, status, is_active")
      .eq("company_id", scope.companyId);
    existingQuery = scope.branchId
      ? existingQuery.eq("branch_id", scope.branchId)
      : existingQuery.is("branch_id", null);
    const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
    if (lookupError) throw new Error("Não foi possível localizar a configuração atual.");

    // Editing a working router's label or policy must never silently turn the
    // captive portal off. A vendor change is a different integration and does
    // deliberately return to homologation.
    if (
      existing &&
      existing.vendor === data.vendor &&
      existing.status === "operational" &&
      existing.is_active
    ) {
      record.status = "operational";
      record.is_active = true;
    }

    const result = existing
      ? await supabaseAdmin
          .from("hotspot_configs")
          .update(record)
          .eq("id", existing.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("hotspot_configs").insert(record).select("*").single();

    if (result.error || !result.data) {
      throw new Error("Não foi possível salvar a configuração do equipamento.");
    }

    if (data.vendor === "mikrotik_hotspot" && data.routerIdentity) {
      const devicePayload = {
        hotspot_config_id: result.data.id,
        company_id: scope.companyId,
        branch_id: scope.branchId,
        router_identity: data.routerIdentity,
        ap_mac: data.apMac || null,
        status: record.status === "operational" ? "operational" : "awaiting_homologation",
        updated_at: new Date().toISOString(),
      };
      const { data: existingDevice } = await (supabaseAdmin as any).from("hotspot_devices").select("id").or(`hotspot_config_id.eq.${result.data.id},router_identity.eq.${data.routerIdentity}`).maybeSingle();
      const deviceResult = existingDevice
        ? await (supabaseAdmin as any).from("hotspot_devices").update(devicePayload).eq("id", existingDevice.id)
        : await (supabaseAdmin as any).from("hotspot_devices").insert(devicePayload);
      const deviceError = deviceResult.error;
      if (deviceError) throw new Error("Configuração salva, mas não foi possível cadastrar a RB.");
    }

    const isOperational = record.status === "operational" && record.is_active === true;

    return {
      success: true,
      config: toPublicConfig(result.data),
      message:
        data.vendor === "test"
          ? "Configuração salva em modo de simulação."
          : isOperational
            ? "Configuração salva. A RB está operacional e a nova política será aplicada no próximo check-in."
            : "Configuração técnica salva. A liberação real continua desativada até a homologação.",
    };
  });

const deviceActionSchema = z.object({
  kind: z.enum(["company", "branch"]),
  targetId: z.string().uuid(),
});

async function getScopedConfigId(userId: string, target: z.infer<typeof targetSchema>) {
  const scope = await resolveScope(userId, target);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin.from("hotspot_configs").select("id").eq("company_id", scope.companyId);
  query = scope.branchId ? query.eq("branch_id", scope.branchId) : query.is("branch_id", null);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("Configuração do equipamento não encontrada.");
  return data.id;
}

export const cancelHotspotHomologation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deviceActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const configId = await getScopedConfigId(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("hotspot_configs").update({ status: "awaiting_homologation", is_active: false, updated_at: now }).eq("id", configId);
    if (error) throw new Error("Não foi possível cancelar a homologação.");
    await (supabaseAdmin as any).from("hotspot_devices").update({ status: "awaiting_homologation", updated_at: now }).eq("hotspot_config_id", configId);
    return { success: true };
  });

export const activateHotspotHomologation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deviceActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const configId = await getScopedConfigId(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("hotspot_configs")
      .update({ status: "operational", is_active: true, updated_at: now })
      .eq("id", configId);
    if (error) throw new Error("Não foi possível ativar a homologação.");
    const { error: deviceError } = await (supabaseAdmin as any)
      .from("hotspot_devices")
      .update({ status: "operational", updated_at: now })
      .eq("hotspot_config_id", configId);
    if (deviceError) throw new Error("Não foi possível ativar o equipamento.");
    return { success: true };
  });

export const setHotspotBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deviceActionSchema.extend({ blocked: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const configId = await getScopedConfigId(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("hotspot_configs").update({ status: data.blocked ? "blocked" : "awaiting_homologation", is_active: false, updated_at: now }).eq("id", configId);
    if (error) throw new Error("Não foi possível atualizar o bloqueio.");
    await (supabaseAdmin as any).from("hotspot_devices").update({ status: data.blocked ? "blocked" : "awaiting_homologation", updated_at: now }).eq("hotspot_config_id", configId);
    return { success: true };
  });
