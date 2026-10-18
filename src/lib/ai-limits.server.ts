import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export type IncrementAiUsageResult = {
  allowed: boolean;
  error: string | null;
};

const IncrementAiUsageResultSchema = z.object({
  allowed: z.boolean(),
  error: z.string().nullable(),
});

export async function checkAiLimitAndIncrement(supabase: SupabaseClient<Database>, userId: string) {
  // 1. Reset daily usage first (America/Sao_Paulo timezone reset happens in RPC)
  await supabase.rpc("reset_daily_ai_usage");

  // 2. Resolve the role with the authenticated request session. Using the
  // administrative client here made Lovable depend on a server secret merely
  // to read the current user's own role, which caused valid users to be denied.
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError)
    throw new Error(`Não foi possível validar as permissões de IA: ${roleError.message}`);
  if (!roleData) return { allowed: false, error: "Usuário sem permissões." };

  const { role, company_id, branch_id } = roleData;

  // ADM has no limits
  if (role === "adm") {
    return { allowed: true, error: null };
  }

  if (!company_id) return { allowed: false, error: "Identificação da empresa ausente." };

  // Define a wrapper that only increments if the AI call was successful.
  // We'll return the increment function for the caller to trigger.
  const increment = async () => {
    if (role === "matriz") {
      const { data: result, error } = await supabase.rpc("increment_ai_usage_safe", {
        _user_id: userId,
        _company_id: company_id,
      });
      if (error) throw new Error(`Não foi possível registrar o uso da IA: ${error.message}`);
      return IncrementAiUsageResultSchema.parse(result);
    } else if (role === "filial") {
      if (!branch_id) return { allowed: false, error: "Contexto de unidade ausente." };
      const { data: result, error } = await supabase.rpc("increment_ai_usage_safe", {
        _user_id: userId,
        _company_id: company_id,
        _branch_id: branch_id,
      });
      if (error) throw new Error(`Não foi possível registrar o uso da IA: ${error.message}`);
      return IncrementAiUsageResultSchema.parse(result);
    }
    return { allowed: false, error: "Papel não suportado." };
  };

  // Check current usage without incrementing
  const { data: limits, error: limitsError } = await supabase.rpc("get_ai_limits_distribution", {
    _company_id: company_id,
  });
  if (limitsError)
    throw new Error(`Não foi possível consultar a cota de IA: ${limitsError.message}`);

  const dist = limits as {
    total_limit: number;
    matriz_limit: number;
    pool_filiais: number;
    active_filiais_count: number;
    filial_limit: number;
    bonus_limit: number;
  };

  // Get current usages to check against distribution
  const { data: companyUsage } = await supabase
    .from("companies")
    .select("ai_usage_today")
    .eq("id", company_id)
    .single();

  const matrizUsage = companyUsage?.ai_usage_today || 0;

  if (role === "matriz") {
    if (matrizUsage >= dist.matriz_limit) {
      return { allowed: false, error: "Cota diária de IA atingida pela Matriz.", increment };
    }
  } else if (role === "filial" && branch_id) {
    const { data: branch } = await supabase
      .from("branches")
      .select("ai_usage_today")
      .eq("id", branch_id)
      .maybeSingle();

    const branchUsage = branch?.ai_usage_today || 0;

    // Check individual limit
    if (branchUsage >= dist.filial_limit) {
      // Check shared pool bonus (sum of all filiais)
      const { data: allBranchesUsage } = await supabase
        .from("branches")
        .select("ai_usage_today")
        .eq("company_id", company_id)
        .eq("active", true)
        .eq("is_headquarters", false);

      const totalFiliaisUsage =
        allBranchesUsage?.reduce((acc, b) => acc + (b.ai_usage_today || 0), 0) || 0;

      if (totalFiliaisUsage >= dist.pool_filiais) {
        return {
          allowed: false,
          error: "Cota diária de IA atingida para sua unidade (limite compartilhado excedido).",
          increment,
        };
      }
    }
  }

  return { allowed: true, error: null, increment };
}

/**
 * Cota leve para turnos de pergunta do Manos Tech IA (gerador de banners).
 * Cada pergunta custa Tavily + DeepSeek; sem cota, daria para conversar o dia
 * todo de graça. Limite: 30 perguntas/dia (matriz = empresa, filial = unidade).
 * Segue o mesmo padrão de checkAiLimitAndIncrement: pré-checagem sem débito,
 * débito via increment() somente quando a pergunta for realmente enviada.
 */
export async function checkAiQuestionLimit(supabase: SupabaseClient<Database>, userId: string) {
  await supabase.rpc("reset_daily_ai_usage");

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError)
    throw new Error(`Não foi possível validar as permissões de IA: ${roleError.message}`);
  if (!roleData) return { allowed: false, error: "Usuário sem permissões." };

  const { role, company_id, branch_id } = roleData;

  if (role === "adm") {
    return { allowed: true, error: null };
  }

  if (!company_id) return { allowed: false, error: "Identificação da empresa ausente." };

  const increment = async () => {
    const args =
      role === "filial" && branch_id
        ? { _user_id: userId, _company_id: company_id, _branch_id: branch_id }
        : { _user_id: userId, _company_id: company_id };
    const { data: result, error } = await supabase.rpc("increment_ai_question_usage_safe", args);
    if (error) throw new Error(`Não foi possível registrar a pergunta: ${error.message}`);
    return IncrementAiUsageResultSchema.parse(result);
  };

  // Pré-checagem sem débito: lê o contador atual.
  if (role === "matriz") {
    const { data } = await supabase
      .from("companies")
      .select("ai_questions_today")
      .eq("id", company_id)
      .maybeSingle();
    if ((data?.ai_questions_today ?? 0) >= 30) {
      return {
        allowed: false,
        error: "Limite diário de perguntas à IA atingido. Tente novamente amanhã.",
        increment,
      };
    }
  } else if (role === "filial") {
    if (!branch_id) return { allowed: false, error: "Contexto de unidade ausente." };
    const { data } = await supabase
      .from("branches")
      .select("ai_questions_today")
      .eq("id", branch_id)
      .maybeSingle();
    if ((data?.ai_questions_today ?? 0) >= 30) {
      return {
        allowed: false,
        error: "Limite diário de perguntas à IA atingido para sua unidade. Tente novamente amanhã.",
        increment,
      };
    }
  } else {
    return { allowed: false, error: "Papel não suportado." };
  }

  return { allowed: true, error: null, increment };
}
