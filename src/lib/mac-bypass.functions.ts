import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

const listInput = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
});

const addInput = z.object({
  company_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
  mac_address: z
    .string()
    .trim()
    .regex(macRegex, "MAC inválido. Use o formato XX:XX:XX:XX:XX:XX"),
  label: z.string().trim().min(1, "Informe um nome para o dispositivo").max(80),
});

const removeInput = z.object({
  id: z.string().uuid(),
});

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function checkPermission(
  supabaseAdmin: AdminClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível validar as permissões.");
  const allowed = (roles ?? []).some(
    (r: { role: string; company_id: string | null }) =>
      r.role === "adm" ||
      (r.role === "matriz" && r.company_id === companyId),
  );
  if (!allowed) throw new Error("Sem permissão para gerenciar dispositivos liberados.");
}

function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase();
}

/** Lista os MACs liberados de uma empresa (opcionalmente filtrado por filial). */
export const listMacBypass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    let query = (supabaseAdmin as any)
      .from("hotspot_mac_bypass")
      .select("id, company_id, branch_id, mac_address, label, created_at")
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: false });
    if (data.branch_id) query = query.eq("branch_id", data.branch_id);

    const { data: rows, error } = await query;
    if (error) throw new Error("Não foi possível listar os dispositivos liberados.");
    return rows ?? [];
  });

/** Adiciona um MAC à lista de liberados. */
export const addMacBypass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => addInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    await checkPermission(supabaseAdmin as AdminClient, userId, data.company_id);

    const mac = normalizeMac(data.mac_address);
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("hotspot_mac_bypass")
      .insert({
        company_id: data.company_id,
        branch_id: data.branch_id ?? null,
        mac_address: mac,
        label: data.label.trim(),
      })
      .select("id, company_id, branch_id, mac_address, label, created_at")
      .single();
    if (error) {
      if (String(error.message ?? "").includes("duplicate") || (error as { code?: string }).code === "23505") {
        throw new Error("Este MAC já está liberado.");
      }
      throw new Error("Não foi possível adicionar o dispositivo.");
    }
    return inserted;
  });

/** Remove um MAC da lista de liberados. */
export const removeMacBypass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => removeInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: existing, error: fetchError } = await (supabaseAdmin as any)
      .from("hotspot_mac_bypass")
      .select("company_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchError || !existing) throw new Error("Dispositivo não encontrado.");
    await checkPermission(supabaseAdmin as AdminClient, userId, existing.company_id);

    const { error } = await (supabaseAdmin as any)
      .from("hotspot_mac_bypass")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível remover o dispositivo.");
    return { ok: true };
  });
