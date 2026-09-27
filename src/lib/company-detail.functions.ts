import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompanyDetail } from "@/lib/company-detail.server";

export const getCompanyDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { companyId: string; days?: number }) => ({
    companyId: String(input.companyId),
    days: input.days ? Number(input.days) : 30,
  }))
  .handler(async ({ context, data }): Promise<CompanyDetail | null> => {
    const { computeCompanyDetail } = await import("@/lib/company-detail.server");
    return computeCompanyDetail(context.supabase, data.companyId, data.days);
  });

export const setCompanyBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { companyId: string; blocked: boolean }) => ({
    companyId: String(input.companyId),
    blocked: Boolean(input.blocked),
  }))
  .handler(async ({ context, data }) => {
    const { data: isAdm } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "adm",
    });
    if (!isAdm) throw new Error("Apenas o ADM Manos Tech pode bloquear ou liberar empresas.");

    const { error } = await context.supabase
      .from("companies")
      .update({ blocked: data.blocked, status: data.blocked ? "bloqueada" : "ativa" })
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { blocked: data.blocked };
  });
