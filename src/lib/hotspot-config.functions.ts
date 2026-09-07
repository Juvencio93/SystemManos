import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const targetSchema = z.object({
  kind: z.enum(["company", "branch"]),
  targetId: z.string().uuid(),
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
});

type HotspotConfigRow = Database["public"]["Tables"]["hotspot_configs"]["Row"];
type UserRoleRow = Pick<
  Database["public"]["Tables"]["user_roles"]["Row"],
  "role" | "company_id" | "branch_id"
>;

const ROLE_PRIORITY = ["adm", "matriz", "filial", "revenda"] as const;

async function resolveScope(
  userId: string,
  target: z.infer<typeof targetSchema>,
): Promise<{ companyId: string; branchId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let companyId = target.targetId;
  let branchId: string | null = null;

  if (target.kind === "company") {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .select("id")
      .eq("id", target.targetId)
      .maybeSingle();
    if (error || !company) throw new Error("Matriz não encontrada.");
  } else {
    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .select("id, company_id")
      .eq("id", target.targetId)
      .maybeSingle();
    if (error || !branch) throw new Error("Filial não encontrada.");
    companyId = branch.company_id;
    branchId = branch.id;
  }

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId);
  if (rolesError) throw new Error("Não foi possível validar as permissões.");

  const primaryRole = ([...(roles ?? [])] as UserRoleRow[]).sort(
    (a, b) => ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role),
  )[0];

  if (primaryRole?.role !== "adm") {
    throw new Error("Configuração de equipamento disponível apenas para ADM.");
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

export const saveHotspotConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const scope = await resolveScope(context.userId, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const statusByVendor = {
      test: "simulation_only",
      mikrotik_hotspot: "awaiting_radius",
      intelbras_zeus: "awaiting_secret",
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
      .select("id")
      .eq("company_id", scope.companyId);
    existingQuery = scope.branchId
      ? existingQuery.eq("branch_id", scope.branchId)
      : existingQuery.is("branch_id", null);
    const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
    if (lookupError) throw new Error("Não foi possível localizar a configuração atual.");

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

    return {
      success: true,
      config: toPublicConfig(result.data),
      message:
        data.vendor === "test"
          ? "Configuração salva em modo de simulação."
          : "Configuração técnica salva. A liberação real continua desativada até a homologação.",
    };
  });
