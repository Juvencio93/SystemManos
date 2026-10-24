import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { Json } from "@/integrations/supabase/types";
import {
  BRIEFING_SYSTEM_BASE,
  BRIEFING_SYSTEM_FILIAL,
  briefingPrompt,
  computeInsights,
  type Insights,
} from "@/lib/insights.server";
import { isBannerCreationRequest } from "@/lib/banner-intent";

export async function generateInsight(prompt: string, system: string) {
  const { callGateway } = await import("@/lib/ai.server");
  const contextFields =
    system.includes("Gerente de Inteligência") || system.includes("Especialista de Marketing")
      ? "Contexto Encontrado: Perfil Comercial (Segmento, Descrição, Objetivo, Nome, Métricas Operacionais)"
      : "Contexto Encontrado: Métricas Globais da Plataforma";

  console.log(`[AI Context Log] ${contextFields}`);

  const response = await callGateway(system, prompt);
  return response.text;
}

export async function resolveContext(
  supabase: Parameters<typeof computeInsights>[0],
  userId: string,
  targetCompanyId?: string,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("role, company_id, branch_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { role: null, companyId: null, branchId: null };

  const role = data.role as "adm" | "matriz" | "filial";
  let companyId = data.company_id;
  const branchId = data.branch_id;

  // Fallback para Filial: se branch_id existe mas company_id é nulo no user_roles,
  // resolvemos via tabela branches usando supabaseAdmin para evitar RLS.
  if (role === "filial" && branchId && !companyId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("company_id")
      .eq("id", branchId)
      .single();
    if (branch) companyId = branch.company_id;
  }

  // If targetCompanyId is provided and user is admin, we resolve the context for that company
  if (role === "adm" && targetCompanyId) {
    return {
      role,
      companyId: targetCompanyId,
      branchId: null,
    };
  }

  return {
    role,
    companyId,
    branchId,
  };
}

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Insights> => {
    const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId) as { role: string | null; companyId: string | null; branchId: string | null };
    return computeInsights(context.supabase, role as any, companyId, branchId);
  });

export const getAiBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      text: string | null;
      updatedAt?: string | null;
      error: string | null;
      requestId?: string | null;
    }> => {
      const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
      const limitCheck = await checkAiLimitAndIncrement(context.supabase, context.userId);
      if (!limitCheck.allowed) return { text: null, error: limitCheck.error };

      const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);
      const insights = await computeInsights(context.supabase, role, companyId, branchId);

      const system = BRIEFING_SYSTEM_BASE + (role === "filial" ? BRIEFING_SYSTEM_FILIAL : "");

      const { callGateway } = await import("@/lib/ai.server");
      const response = await callGateway(system, `Dados da operação:\n${briefingPrompt(insights)}`);

      if (response.text && limitCheck.increment) {
        await limitCheck.increment();
      }

      return {
        text: response.text,
        updatedAt: new Date().toISOString(),
        error: response.error,
        requestId: response.requestId,
      };
    },
  );

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { role } = await resolveContext(context.supabase, context.userId);
    if (role !== "adm") return null;
    const { computePlatformSnapshot } = await import("@/lib/platform.server");
    return computePlatformSnapshot(context.supabase);
  });

export const getCompanyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);
    if (!role || !(["matriz", "filial", "revenda"] as string[]).includes(role)) return null;

    const { computeCompanySnapshot, companyPrompt, COMPANY_ALERTS_SYSTEM } =
      await import("@/lib/company.server");

    const { CompanySnapshotSchema } = await import("./utils/date-utils");

    let targetCompanyId = companyId;
    const targetBranchId = branchId;

    if ((role as string) === "revenda") {
      const { data: resellerRole } = await context.supabase
        .from("user_roles")
        .select("reseller_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      const { data: firstCompany } = await context.supabase
        .from("companies")
        .select("id")
        .eq("reseller_id", resellerRole?.reseller_id ?? "")
        .eq("is_active" as any, true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      targetCompanyId = firstCompany?.id ?? null;
    }

    if (role === "filial" && !targetCompanyId && targetBranchId) {
      const { data: branch } = await context.supabase
        .from("branches")
        .select("company_id")
        .eq("id", targetBranchId)
        .single();
      targetCompanyId = branch?.company_id ?? null;
    }

    if (!targetCompanyId) return null;

    const rawSnapshot = await computeCompanySnapshot(
      context.supabase,
      targetCompanyId,
      targetBranchId,
    );
    const snapshot = CompanySnapshotSchema.parse(rawSnapshot);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // A IA só deve ser executada pelo fluxo manual já existente.
    // getCompanyOverview agora apenas carrega os dados e o cache existente.
    return snapshot;

    return snapshot;
  });

export const getCompanyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ text: string | null; updatedAt?: string | null; error: string | null }> => {
      const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
      const limitCheck = await checkAiLimitAndIncrement(context.supabase, context.userId);
      if (!limitCheck.allowed) return { text: null, error: limitCheck.error };

      const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);

      if (!role || (role !== "matriz" && role !== "filial")) {
        return { text: null, error: "Disponível apenas para o perfil Empresa ou Filial." };
      }

      const { computeCompanySnapshot, companyPrompt, COMPANY_SYSTEM } =
        await import("@/lib/company.server");

      let targetCompanyId = companyId;
      const targetBranchId = branchId;

      if (role === "filial" && !targetCompanyId && targetBranchId) {
        const { data: branch } = await context.supabase
          .from("branches")
          .select("company_id")
          .eq("id", targetBranchId)
          .single();
        targetCompanyId = branch?.company_id ?? null;
      }

      if (!targetCompanyId) {
        return {
          text: null,
          error: "Não foi possível identificar sua empresa. Entre em contato com o administrador.",
        };
      }

      const { CompanySnapshotSchema } = await import("./utils/date-utils");
      const rawSnapshot = await computeCompanySnapshot(
        context.supabase,
        targetCompanyId,
        targetBranchId,
      );
      const snapshot = CompanySnapshotSchema.parse(rawSnapshot);

      // Check cache/throttle
      const { data: company } = await context.supabase
        .from("companies")
        .select("ai_insights_updated_at, ai_insights_cache")
        .eq("id", snapshot.id)
        .maybeSingle();

      if (company?.ai_insights_updated_at) {
        const diffMin = (Date.now() - new Date(company.ai_insights_updated_at).getTime()) / 60000;
        if (diffMin < 10) return { text: JSON.stringify(company.ai_insights_cache), error: null };
      }

      const { callGateway } = await import("@/lib/ai.server");
      const response = await callGateway(
        COMPANY_SYSTEM,
        `Gere o resumo estruturado da empresa.\nDados:\n${companyPrompt(snapshot)}`,
      );

      if (response.text) {
        try {
          const jsonMatch = response.text.match(/\{[\s\S]*\}/);
          const aiData = JSON.parse(jsonMatch ? jsonMatch[0] : response.text);

          console.log(
            `[AI Briefing Log] Contexto utilizado: Segmento="${snapshot.business_segment}", Objetivo="${snapshot.wifi_marketing_goal}", Conexões=${snapshot.totalConexoes}`,
          );

          await context.supabase
            .from("companies")
            .update({
              ai_insights_cache: aiData as Json,
              ai_insights_updated_at: new Date().toISOString(),
            })
            .eq("id", snapshot.id);
        } catch (e) {
          console.error("[AI Briefing Log] Failed to parse JSON response:", e);
        }
      }

      return {
        text: response.text,
        updatedAt: new Date().toISOString(),
        error: response.error,
      };
    },
  );

export const getAdmBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ text: string | null; updatedAt?: string | null; error: string | null }> => {
      const { role } = await resolveContext(context.supabase, context.userId);
      if (role !== "adm") return { text: null, error: "Disponível apenas para o perfil ADM." };
      const { computePlatformSnapshot, platformPrompt, ADM_ALERTS_SYSTEM } =
        await import("@/lib/platform.server");
      const snapshot = await computePlatformSnapshot(context.supabase);

      const { callGateway } = await import("@/lib/ai.server");
      const response = await callGateway(
        ADM_ALERTS_SYSTEM,
        `Gere o resumo da semana da Manos Tech (visão consolidada da plataforma). Use texto livre amigável (Markdown).\nDados:\n${platformPrompt(snapshot)}`,
      );
      return {
        text: response.text,
        updatedAt: new Date().toISOString(),
        error: response.error,
      };
    },
  );

type OperationalAiConversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  hidden_at: string | null;
};

type OperationalAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

async function ensureOperationalAiConversation(
  supabase: any,
  userId: string,
  conversationId?: string,
): Promise<OperationalAiConversation> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("operational_ai_conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Conversa do Gerente Operacional não encontrada.");
    return data as OperationalAiConversation;
  }

  const { data: latest, error: latestError } = await supabase
    .from("operational_ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (latest) return latest as OperationalAiConversation;

  const { data: created, error: createError } = await supabase
    .from("operational_ai_conversations")
    .insert({ user_id: userId, title: "Nova conversa" })
    .select("id, title, created_at, updated_at")
    .single();
  if (createError) throw new Error(createError.message);
  return created as OperationalAiConversation;
}

export const getAiUsageSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.rpc("reset_daily_ai_usage");
    const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);
    if (!companyId || (role !== "matriz" && role !== "filial")) return null;
    const { data: distribution, error } = await context.supabase.rpc("get_ai_limits_distribution", { _company_id: companyId });
    if (error) throw new Error(error.message);
    const limits = distribution as { matriz_limit: number; filial_limit: number };
    if (role === "matriz") {
      const { data } = await context.supabase.from("companies").select("ai_usage_today").eq("id", companyId).single();
      const used = data?.ai_usage_today || 0;
      return { limit: limits.matriz_limit, used, available: Math.max(0, limits.matriz_limit - used) };
    }
    const { data } = await context.supabase.from("branches").select("ai_usage_today").eq("id", branchId!).single();
    const used = data?.ai_usage_today || 0;
    return { limit: limits.filial_limit, used, available: Math.max(0, limits.filial_limit - used) };
  });

export type AskAgentResponse =
  | {
      ok: true;
      text: string;
      requestId: string;
      provider: "deepseek";
      model: "deepseek-v4-flash";
      error: null;
    }
  | {
      ok: false;
      text: null;
      requestId: string;
      error: string;
      stage: string;
      code?: string;
    };

export const askAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const schema = z.object({
      question: z.string().min(1).max(800),
      conversationId: z.string().uuid().optional(),
      messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
        .optional(),
    });
    return schema.parse(input);
  })
  .handler(async ({ context, data }): Promise<AskAgentResponse> => {
    const requestId = crypto.randomUUID();

    try {
      const { callGateway } = await import("@/lib/ai.server");
      const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
      const limitCheck = await checkAiLimitAndIncrement(context.supabase, context.userId);

      if (!limitCheck.allowed) {
        return {
          ok: false,
          text: null,
          requestId,
          error: limitCheck.error || "Cota de IA excedida.",
          stage: "quota_check",
        };
      }

      const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);

      if (!role) {
        return {
          ok: false,
          text: null,
          requestId,
          error: "Usuário sem perfil configurado.",
          stage: "auth_role",
        };
      }

      let response;

      if (role === "adm") {
        // Bate-papo do Gerente Operacional IA desabilitado (decisão 2026-10-18).
        // Ações operacionais agora são 100% via Hermes no Telegram.
        // O ramo matriz/filial (chat da empresa) abaixo continua funcionando.
        return {
          ok: false,
          text: null,
          requestId,
          error:
            "O bate-papo do Gerente Operacional IA foi desabilitado. Para ações operacionais, use a ManosTech IA no Telegram.",
          stage: "disabled",
        };
      } else if (role === "matriz" || role === "filial") {
        const {
          computeCompanySnapshot,
          companyPrompt,
          COMPANY_CHAT_SYSTEM,
          COMPANY_CHAT_BANNER_SYSTEM,
        } = await import("@/lib/company.server");

        if (!companyId) {
          return {
            ok: false,
            text: null,
            requestId,
            error: "Não foi possível identificar a empresa vinculada ao seu acesso.",
            stage: "context_resolution",
          };
        }

        const { CompanySnapshotSchema } = await import("./utils/date-utils");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rawSnapshot = await computeCompanySnapshot(supabaseAdmin, companyId, branchId);
        const snapshot = CompanySnapshotSchema.parse(rawSnapshot);
        const retentionCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
        await context.supabase.from("operational_ai_conversations").delete().eq("user_id", context.userId).lt("updated_at", retentionCutoff);
        const conversation = await ensureOperationalAiConversation(context.supabase, context.userId, data.conversationId);
        const { data: storedMessages } = await context.supabase.from("operational_ai_messages")
          .select("role, content, created_at").eq("conversation_id", conversation.id)
          .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20);
        await context.supabase.from("operational_ai_messages").insert({ conversation_id: conversation.id, user_id: context.userId, role: "user", content: data.question.trim() });

        // Perguntas consultivas sobre imagens ou identidade visual permanecem na
        // conversa. O gerador especializado só assume pedidos claros de criação.
        const system = isBannerCreationRequest(data.question)
          ? COMPANY_CHAT_BANNER_SYSTEM
          : COMPANY_CHAT_SYSTEM;

        const companyHistory = (storedMessages || []).reverse().slice(-10).map((message: any) => ({ role: message.role as "user" | "assistant", content: message.content }));
        response = await callGateway(
          system,
          `${companyPrompt(snapshot)}\n\nPERGUNTA DO CLIENTE: ${data.question}`,
          companyHistory,
        );
        if (response.ok && response.text) {
          await context.supabase.from("operational_ai_messages").insert({ conversation_id: conversation.id, user_id: context.userId, role: "assistant", content: response.text });
          await context.supabase.from("operational_ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id).eq("user_id", context.userId);
        }
      } else {
        console.error(`[askAgent] Unauthorized role: ${role}`);
        return {
          ok: false,
          text: null,
          requestId,
          error: "Perfil não autorizado para usar a IA.",
          stage: "auth_role",
        };
      }

      if (response.ok && response.text) {
        if (limitCheck.increment) {
          const commit = await limitCheck.increment();
          if (!commit.allowed) {
            return {
              ok: false,
              text: null,
              requestId: response.requestId,
              error: commit.error || "Erro ao processar cota.",
              stage: "quota_commit",
            };
          }
        }

        return {
          ok: true,
          text: response.text,
          requestId: response.requestId,
          provider: "deepseek",
          model: "deepseek-v4-flash",
          error: null,
        };
      }

      return {
        ok: false,
        text: null,
        requestId: response.requestId || requestId,
        error: response.error || "Falha na comunicação com a IA.",
        stage: response.ok ? "empty_response" : response.stage || "deepseek_failure",
      };
    } catch (e: any) {
      console.error(`[askAgent Error] RequestId=${requestId}`, e.message, e.stack);
      return {
        ok: false,
        text: null,
        requestId,
        error: "Ocorreu um erro técnico ao processar sua solicitação.",
        stage: "internal_error",
        code: "IA-EB3D7B68",
      };
    }
  });

