/**
 * Kit do cliente do revendedor — server functions do fluxo "Nova Empresa
 * Cliente" do /revendas.
 *
 * O fluxo reaproveita a maquinaria oficial que já existe:
 * - a empresa é criada por `createCompanyWithAccess` (cnpj.functions.ts),
 *   que debita 1 crédito da revenda via RPC `reseller_consume_credit_for_unit`
 *   e apaga a empresa quando não há crédito;
 * - o equipamento entra no estoque pela RPC `manage_hotspot_inventory`
 *   (create por MAC + assign_by_mac no destino), exatamente como a tela de
 *   Estoque de RBs faz;
 * - o .rsc é baixado pelo gerador oficial (`downloadRbSetup`, kind=setup),
 *   que junta MANOS-HOTSPOT-BASE.rsc + ativação RADIUS + heartbeat para a
 *   identidade MT-... da RB. Não existe .rsc por empresa fora desse gerador.
 *
 * O MAC fica registrado em dois lugares oficiais: `hotspot_devices.ap_mac`
 * (vínculo da RB) e `hotspot_configs.ap_mac` (destino). Não há tabela nova.
 */
import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMac } from "./rb-inventory";
import { isValidMac } from "./reseller-client-kit";
import { encryptConfigSecrets } from "@/lib/crypto.server";
import type { Json } from "@/integrations/supabase/types";
import type { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminClient = typeof supabaseAdmin;

const macInput = z.object({ mac: z.string().trim().min(1).max(20) });

/** Validador puro (testável) do MAC — o serverFn usa o mesmo. */
export function validateCheckClientKitMacInput(data: unknown) {
  return macInput.parse(data);
}

const registerKitInput = z.object({
  companyId: z.string().uuid(),
  mac: z.string().trim().min(1).max(20),
  nickname: z.string().trim().max(80).optional().nullable(),
});

/** Validador puro (testável) do vínculo do kit — o serverFn usa o mesmo. */
export function validateRegisterClientKitInput(data: unknown) {
  return registerKitInput.parse(data);
}

type CallerScope =
  | { kind: "adm" }
  | { kind: "revenda"; resellerId: string };

async function resolveCallerScope(
  supabase: AdminClient,
  userId: string,
): Promise<CallerScope> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, reseller_id")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar suas permissões.");
  if (data?.some((role) => role.role === "adm")) return { kind: "adm" };
  const resellerId = data?.find((role) => role.role === "revenda")?.reseller_id ?? null;
  if (!resellerId) throw new Error("Sua conta de revenda não está vinculada a uma rede.");
  return { kind: "revenda", resellerId };
}

async function macAlreadyInUse(
  supabaseAdmin: AdminClient,
  normalizedMac: string,
): Promise<boolean> {
  const hex = normalizedMac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const { data, error } = await (supabaseAdmin as any)
    .from("hotspot_devices")
    .select("ap_mac")
    .neq("status", "suspended");
  if (error) throw new Error("Não foi possível verificar o MAC informado.");
  return (data ?? []).some(
    (row: { ap_mac: string | null }) =>
      (row.ap_mac ?? "").replace(/[^0-9A-Fa-f]/g, "").toUpperCase() === hex,
  );
}

/**
 * Verifica se o MAC pode ser usado, antes de criar a empresa (para não gastar
 * o crédito à toa). Retorna o MAC normalizado quando está livre.
 */
export const checkClientKitMac = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => validateCheckClientKitMacInput(data))
  .handler(async ({ data }) => {
    if (!isValidMac(data.mac)) {
      throw new Error(
        "MAC inválido. Confira os 12 caracteres da etiqueta da RB (ex.: AA:BB:CC:11:22:33).",
      );
    }
    const normalized = normalizeMac(data.mac)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await macAlreadyInUse(supabaseAdmin, normalized)) {
      throw new Error(
        "Já existe um equipamento com este MAC. Confira a etiqueta da RB ou use outro equipamento.",
      );
    }
    return { available: true, normalizedMac: normalized };
  });

/**
 * Vincula o equipamento (MAC) à empresa do cliente e deixa o kit pronto para
 * baixar. A empresa já deve existir (criada pelo modal, com 1 crédito
 * debitado). Cria a configuração de Wi-Fi da matriz, cadastra a RB no estoque
 * pelo MAC e atribui ao destino — o mesmo caminho da tela de Estoque de RBs.
 */
export const registerClientKit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => validateRegisterClientKitInput(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await resolveCallerScope(supabaseAdmin, context.userId);
    if (scope.kind !== "revenda") {
      throw new Error("O kit do cliente é gerado no painel da própria revenda.");
    }
    if (!isValidMac(data.mac)) {
      throw new Error(
        "MAC inválido. Confira os 12 caracteres da etiqueta da RB (ex.: AA:BB:CC:11:22:33).",
      );
    }
    const normalizedMac = normalizeMac(data.mac)!;
    const nickname = data.nickname?.trim() || null;

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, trade_name, slug, reseller_id")
      .eq("id", data.companyId)
      .maybeSingle();
    if (companyError) throw new Error("Não foi possível localizar a empresa.");
    if (!company || company.reseller_id !== scope.resellerId) {
      throw new Error("Esta empresa não pertence à sua revenda.");
    }
    if (await macAlreadyInUse(supabaseAdmin, normalizedMac)) {
      throw new Error(
        "Já existe um equipamento com este MAC. Confira a etiqueta da RB ou use outro equipamento.",
      );
    }

    const { data: headquarters, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("company_id", company.id)
      .eq("is_headquarters", true)
      .maybeSingle();
    if (branchError || !headquarters) {
      throw new Error("A matriz ainda não foi criada. Tente de novo em instantes.");
    }

    // Configuração de Wi-Fi da matriz (ou reaproveita a existente sem equipamento).
    const { data: existingConfig } = await supabaseAdmin
      .from("hotspot_configs")
      .select("id, vendor")
      .eq("company_id", company.id)
      .eq("branch_id", headquarters.id)
      .maybeSingle();
    let configId: string;
    if (existingConfig) {
      const { data: linked } = await (supabaseAdmin as any)
        .from("hotspot_devices")
        .select("id")
        .eq("hotspot_config_id", existingConfig.id)
        .maybeSingle();
      if (linked) {
        throw new Error(
          "Esta empresa já tem um equipamento vinculado. Para trocar, use a tela de Wi-Fi da empresa.",
        );
      }
      const { error: updateError } = await supabaseAdmin
        .from("hotspot_configs")
        .update({
          vendor: "mikrotik_hotspot",
          ap_mac: normalizedMac,
          status: "awaiting_homologation",
          is_active: false,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", existingConfig.id);
      if (updateError) throw new Error("Não foi possível preparar a configuração do Wi-Fi.");
      configId = existingConfig.id;
    } else {
      const { data: created, error: createError } = await (supabaseAdmin as any)
        .from("hotspot_configs")
        .insert({
          company_id: company.id,
          branch_id: headquarters.id,
          vendor: "mikrotik_hotspot",
          display_name: company.trade_name || company.name,
          ssid: null,
          ap_mac: normalizedMac,
          integration_mode: null,
          status: "awaiting_homologation",
          session_timeout_seconds: null,
          idle_timeout_seconds: null,
          download_kbps: null,
          upload_kbps: null,
          checkin_limit: 3,
          checkin_block_minutes: 30,
          limit_source: "equipment",
          config: encryptConfigSecrets({}) as Json,
          is_active: false,
        })
        .select("id")
        .single();
      if (createError || !created) {
        throw new Error("Não foi possível preparar a configuração do Wi-Fi.");
      }
      configId = created.id;
    }

    // Cadastra a RB no estoque pelo MAC e atribui ao destino da empresa.
    const identity = `MT-${randomBytes(8).toString("hex").toUpperCase()}`;
    const { error: createError } = await (supabaseAdmin as any).rpc(
      "manage_hotspot_inventory",
      {
        p_actor: context.userId,
        p_action: "create",
        p_device: null,
        p_version: null,
        p_config: null,
        p_label: nickname,
        p_identity: identity,
        p_owner: null,
        p_mac: normalizedMac,
      },
    );
    if (createError) {
      const message = String(createError.message || "");
      if (message.includes("Já existe uma RB com este MAC")) {
        throw new Error(
          "Já existe um equipamento com este MAC. Confira a etiqueta da RB ou use outro equipamento.",
        );
      }
      throw new Error(message || "Não foi possível cadastrar o equipamento.");
    }
    const { error: assignError } = await (supabaseAdmin as any).rpc(
      "manage_hotspot_inventory",
      {
        p_actor: context.userId,
        p_action: "assign_by_mac",
        p_device: null,
        p_version: null,
        p_config: configId,
        p_label: null,
        p_identity: null,
        p_owner: null,
        p_mac: normalizedMac,
      },
    );
    if (assignError) {
      throw new Error(assignError.message || "Não foi possível vincular o equipamento.");
    }

    const { data: device, error: deviceError } = await (supabaseAdmin as any)
      .from("hotspot_devices")
      .select("id, router_identity, assignment_version, status")
      .eq("hotspot_config_id", configId)
      .maybeSingle();
    if (deviceError || !device) {
      throw new Error("Equipamento vinculado, mas não foi possível localizar o kit.");
    }

    const { logAdminAction } = await import("./admin-audit-log.server");
    await logAdminAction(supabaseAdmin, {
      userId: context.userId,
      action: "reseller.kit_generated",
      companyId: company.id,
      details: {
        mac: normalizedMac,
        router_identity: device.router_identity,
        nickname,
      },
    });

    return {
      deviceId: device.id as string,
      routerIdentity: device.router_identity as string,
      mac: normalizedMac,
      nickname,
      companyName: (company.trade_name || company.name) as string,
      slug: company.slug as string,
    };
  });

export type ResellerClientKit = {
  companyId: string;
  companyName: string;
  slug: string;
  deviceId: string;
  routerIdentity: string;
  mac: string;
  nickname: string | null;
  status: string;
};

/** Kits já gerados (para o botão "Baixar kit" no card da empresa). */
export const listResellerClientKits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResellerClientKit[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = await resolveCallerScope(supabaseAdmin, context.userId);
    let query = (supabaseAdmin as any)
      .from("hotspot_devices")
      .select(
        "id, router_identity, ap_mac, inventory_label, status, company_id, companies:company_id(name, trade_name, slug, reseller_id)",
      )
      .not("company_id", "is", null)
      .not("ap_mac", "is", null)
      .order("router_identity");
    if (scope.kind === "revenda") {
      query = query.eq("inventory_reseller_id", scope.resellerId);
    }
    const { data, error } = await query;
    if (error) throw new Error("Não foi possível listar os kits.");
    return (data ?? []).map((row: any) => ({
      companyId: row.company_id as string,
      companyName: (row.companies?.trade_name || row.companies?.name || "") as string,
      slug: (row.companies?.slug || "") as string,
      deviceId: row.id as string,
      routerIdentity: row.router_identity as string,
      mac: row.ap_mac as string,
      nickname: (row.inventory_label ?? null) as string | null,
      status: row.status as string,
    }));
  });
