import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AiLimitsDistributionSchema = z.object({
  matriz_limit: z.number(),
  filial_limit: z.number(),
  total_limit: z.number(),
  pool_filiais: z.number(),
  bonus_limit: z.number(),
});

export const getAiLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Resolve user role and branch/company context
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, company_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleData) throw new Error("Usuário sem permissões.");

    const { role, company_id, branch_id } = roleData;

    if (role === "adm") return null;

    const targetCompanyId = company_id;
    if (!targetCompanyId) return null;

    // 2. Get distribution from RPC
    const { data: distribution, error: distError } = await supabase.rpc(
      "get_ai_limits_distribution",
      {
        _company_id: targetCompanyId as string,
      },
    );

    if (distError) throw new Error(distError.message);

    const dist = AiLimitsDistributionSchema.parse(distribution);

    if (role === "matriz") {
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("ai_usage_today")
        .eq("id", targetCompanyId)
        .single();

      if (companyError) throw new Error(companyError.message);

      const used = companyData.ai_usage_today;
      const limit = dist.matriz_limit;
      const remaining = Math.max(0, limit - used);

      return {
        role,
        isHQ: true, // For visual compatibility
        used,
        limit,
        remaining,
        bonusRemaining: 0,
        poolFiliais: dist.pool_filiais,
        totalLimit: dist.total_limit,
      };
    }

    if (role === "filial") {
      if (!branch_id) return null;

      const { data: branchUsage, error: usageError } = await supabase
        .from("branches")
        .select("ai_usage_today, is_headquarters")
        .eq("id", branch_id)
        .single();

      if (usageError) throw new Error(usageError.message);

      const isHQ = branchUsage.is_headquarters;
      const used = branchUsage.ai_usage_today;
      const limit = isHQ ? dist.matriz_limit : dist.filial_limit;
      const remaining = Math.max(0, limit - used);

      let bonusRemaining = 0;
      if (!isHQ && dist.bonus_limit > 0) {
        const { data: allFiliais } = await supabase
          .from("branches")
          .select("ai_usage_today")
          .eq("company_id", targetCompanyId)
          .eq("active", true)
          .eq("is_headquarters", false);

        const totalFilialUsage = allFiliais?.reduce((sum, b) => sum + b.ai_usage_today, 0) || 0;
        const totalFilialLimit = dist.pool_filiais;
        bonusRemaining = Math.max(0, totalFilialLimit - totalFilialUsage);
      }

      return {
        role,
        isHQ,
        used,
        limit,
        remaining,
        bonusRemaining,
        poolFiliais: dist.pool_filiais,
        totalLimit: dist.total_limit,
      };
    }

    return null;
  });
