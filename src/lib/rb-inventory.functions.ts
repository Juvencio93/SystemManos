import { createServerFn } from "@tanstack/react-start";
import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InventoryData, InventoryDevice } from "./rb-inventory";

async function manager(userId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.from("user_roles").select("role,reseller_id").eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar seu acesso.");
  const admin = data?.some(r => r.role === "adm");
  const resellerId = data?.find(r => r.role === "revenda")?.reseller_id;
  if (!admin && !resellerId) throw new Error("Apenas administradores e revendas gerenciam o estoque.");
  return { db, admin, resellerId };
}

export const listRbInventory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InventoryData> => {
    const { db, admin, resellerId } = await manager(context.userId);
    let query = (db as any).from("hotspot_devices").select("id,router_identity,inventory_label,inventory_reseller_id,company_id,branch_id,hotspot_config_id,status,assignment_version,assignment_applied_version,assignment_requested_at,assignment_applied_at,verification_expires_at,last_seen_at,ap_mac").neq("status", "suspended").order("router_identity");
    if (!admin) query = query.eq("inventory_reseller_id", resellerId);
    const [devices, configs] = await Promise.all([
      query,
      db.from("hotspot_configs").select("id,company_id,branch_id,vendor,companies(name,trade_name,reseller_id),branches(name,reseller_id)").in("vendor", ["mikrotik", "mikrotik_hotspot"]),
    ]);
    if (devices.error || configs.error) throw new Error("Estoque indisponível. Verifique se a migração de RBs foi aplicada.");
    const targets = (configs.data ?? []).filter((c: any) => admin || (c.branches?.reseller_id ?? c.companies?.reseller_id) === resellerId)
      .map((c: any) => ({ id: c.id, companyId: c.company_id, branchId: c.branch_id,
        label: `${c.companies?.trade_name || c.companies?.name || "Empresa"}${c.branch_id ? ` · ${c.branches?.name || "Filial"}` : " · Matriz"}` }));
    const { data: resellers, error: resellerError } = admin ? await db.from("resellers").select("id,name").order("name") : { data:[],error:null };
    if (resellerError) throw new Error("Não foi possível consultar as revendas.");
    return { devices: devices.data as InventoryDevice[], targets, resellers: resellers ?? [] };
  });

const actionSchema = z.object({ action: z.enum(["create", "transfer", "verify", "allocate", "archive"]),
  deviceId: z.string().uuid().optional(), expectedVersion: z.number().int().nonnegative().optional(),
  label: z.string().trim().min(1).max(80).optional(), configId: z.string().uuid().nullable().optional(),
  resellerId: z.string().uuid().nullable().optional(),
}).superRefine((v,c) => {
  if (v.action === "create" ? !v.label : !v.deviceId || v.expectedVersion === undefined)
    c.addIssue({ code: "custom", message: "Dados da operação incompletos." });
});

export const manageRbInventory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: unknown) => actionSchema.parse(input)).handler(async ({ context, data }) => {
    const { db } = await manager(context.userId);
    const { data: id, error } = await (db as any).rpc("manage_hotspot_inventory", {
      p_actor: context.userId, p_action: data.action, p_device: data.deviceId ?? null,
      p_version: data.expectedVersion ?? null, p_config: data.configId ?? null, p_label: data.label ?? null,
      p_identity: data.action === "create" ? `MT-${randomBytes(8).toString("hex").toUpperCase()}` : null,
      p_owner: data.resellerId ?? null,
    });
    if (error) throw new Error(error.message || "Não foi possível atualizar a RB.");
    return { id: id as string };
  });

export const downloadRbSetup = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ deviceId: z.string().uuid(), kind: z.enum(["setup","activation","heartbeat"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const { db, admin, resellerId } = await manager(context.userId);
    const { data: d, error } = await (db as any).from("hotspot_devices").select("router_identity,inventory_reseller_id,assignment_version").eq("id",data.deviceId).single();
    if (error || !d || (!admin && d.inventory_reseller_id !== resellerId)) throw new Error("RB indisponível.");
    const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"];
    if (!secret) throw new Error("Credenciais da integração indisponíveis.");
    const exp = String(Date.now()+600000);
    const sig = createHmac("sha256",secret).update(`${d.router_identity}.${exp}.${data.kind}.${d.assignment_version}`).digest("hex");
    return `/api/internal/mikrotik-activation?router=${d.router_identity}&exp=${exp}&kind=${data.kind}&sig=${sig}&assignmentVersion=${d.assignment_version}`;
  });
