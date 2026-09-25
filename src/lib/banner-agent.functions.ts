import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGateway } from "@/lib/ai.server";
import { runBannerDirector, BannerDirectorError } from "@/lib/banner-director";
import type { BannerMessage } from "@/lib/banner-director";
import {
  extractBannerTurnFacts,
  rebuildBannerConversationBrief,
  commercialStateFromBrief,
  nextCommercialQuestion,
  pendingQuestionForCommercialState,
} from "@/lib/banner-brief";
import type { BannerConversationBrief } from "@/lib/banner-brief";
import { classifyBannerCompatibility } from "@/lib/banner-compatibility";

const BannerMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const BannerAgentInputSchema = z.object({
  messages: z
    .array(BannerMessageSchema.extend({ content: z.string().trim().min(1).max(4_000) }))
    .min(1)
    .max(30),
  isFinalTurn: z.boolean(),
  conversationId: z.string().uuid(),
  brief: z
    .object({
      subject: z.string().optional(),
      offerItems: z.array(z.string()).optional(),
      price: z.number().finite().optional(),
      priceCandidate: z.number().finite().optional(),
      commercialCondition: z.string().optional(),
      validity: z.string().optional(),
      weekday: z.string().optional(),
      weekdays: z.array(z.string()).optional(),
      dateContext: z.enum(["this", "next"]).optional(),
      recurrence: z.enum(["NONE", "WEEKLY"]).optional(),
      unit: z.string().optional(),
      time: z.string().optional(),
      scopeConfirmed: z.boolean().optional(),
      compatibilityConfirmed: z.boolean().optional(),
      pendingQuestion: z
        .enum([
          "subject",
          "offer_scope_confirmation",
          "offer_scope_correction",
          "price_confirmation",
          "business_compatibility_confirmation",
        ])
        .optional(),
    })
    .default({}),
});

export type BannerAgentResponse =
  | {
      success: true;
      data: {
        needsMoreInfo: boolean;
        question: string | null;
        promptOptions: { title: string; prompt: string }[] | null;
        reminder: string | null;
        brief?: BannerConversationBrief;
      };
      error: null;
    }
  | { success: false; data: null; error: string; code?: string };

export function resolveBannerConversationTurn(
  previousBrief: BannerConversationBrief,
  userMessages: readonly string[],
) {
  const activeBrief = rebuildBannerConversationBrief(previousBrief, userMessages);
  const state = commercialStateFromBrief(activeBrief, userMessages);
  const nextQuestion = nextCommercialQuestion(userMessages, activeBrief);
  const pendingQuestion = nextQuestion
    ? pendingQuestionForCommercialState(userMessages, activeBrief)
    : undefined;
  const brief = pendingQuestion ? { ...activeBrief, pendingQuestion } : activeBrief;
  return {
    brief,
    state,
    newFacts: userMessages.length
      ? extractBannerTurnFacts(userMessages[userMessages.length - 1] ?? "", previousBrief)
      : {},
    nextQuestion,
  };
}

export const askBannerAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => BannerAgentInputSchema.parse(input))
  .handler(async ({ context, data }): Promise<BannerAgentResponse> => {
    try {
      // 1. Resolve context and permissions
      const { resolveContext } = await import("./insights.functions");
      const { role, companyId, branchId } = await resolveContext(context.supabase, context.userId);

      if (!role || (role !== "filial" && role !== "matriz")) {
        return {
          success: false,
          data: null,
          error: "Disponível apenas para os perfis Matriz e Filial.",
        };
      }

      if (!companyId) {
        return { success: false, data: null, error: "Empresa não identificada." };
      }

      // Reject exhausted accounts before any provider call.
      const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
      const aiEligibility = await checkAiLimitAndIncrement(context.supabase, context.userId);
      if (!aiEligibility.allowed) {
        return {
          success: false,
          data: null,
          error: aiEligibility.error || "Limite de IA atingido.",
        };
      }

      // 2. Load company context via the dedicated server module
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { loadBannerContext } = await import("@/lib/banner-context.server");
      const company = await loadBannerContext(supabaseAdmin, companyId, branchId ?? null);

      // 3. Tavily: SEMPRE executa pesquisa de ambiente/ramo (obrigatório)
      const { searchCompanyEnvironment } = await import("@/lib/tavily.server");
      const researchProfile = {
        name: company.name,
        tradeName: company.tradeName ?? null,
        legalName: company.legalName ?? null,
        segment: company.segment ?? null,
        description: company.description ?? null,
        address: company.address ?? null,
        neighborhood: company.neighborhood ?? null,
        city: company.city ?? null,
        state: company.state ?? null,
      };
      const research = await searchCompanyEnvironment(researchProfile);

      const researchContext =
        research.confidence === "confirmado"
          ? `PESQUISA CONFIRMADA: fontes públicas identificaram a empresa. Use como direção de arte do ambiente real.\n\n${research.context}`
          : research.confidence === "parcial"
            ? `PESQUISA PARCIAL: uma fonte com correspondência fraca. Inspire estilo/tom mas não descreva ambiente real.\n\n${research.context}`
            : "PESQUISA NÃO CONFIRMADA: sem correspondência confiável. Use estúdio ou fundo neutro.";

      // 4. Briefing vivo: extrai fatos da conversa e decide próxima pergunta
      const userMessages = data.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content);
      const turn = resolveBannerConversationTurn(data.brief, userMessages);
      const activeBrief = turn.brief;

      // 5. Compatibilidade: detecta STRONG_MISMATCH (ex: troca de óleo em padaria)
      const compatibility = classifyBannerCompatibility(
        {
          name: company.name,
          segment: company.segment,
          description: company.description,
          location: [company.city, company.state].filter(Boolean).join(", "),
        },
        activeBrief.subject,
      );
      if (compatibility.classification === "STRONG_MISMATCH") {
        return {
          success: true,
          data: {
            needsMoreInfo: true,
            question: `Não consigo criar um banner de ${activeBrief.subject} porque o cadastro de ${company.name} indica ${company.segment}. Envie uma promoção relacionada ao ramo cadastrado.`,
            promptOptions: null,
            reminder: null,
            brief: { ...activeBrief, pendingQuestion: "subject" },
          },
          error: null,
        };
      }

      // 6. Pergunta determinística: se o briefing estruturado já sabe o que falta,
      // não delega à IA — economiza tokens e evita JSON malformado
      if (turn.nextQuestion) {
        return {
          success: true,
          data: {
            needsMoreInfo: true,
            question: turn.nextQuestion,
            promptOptions: null,
            reminder: null,
            brief: activeBrief,
          },
          error: null,
        };
      }

      // 7. Banner Director: orquestrador com auto-revisão (gera → revisa → corrige)
      const messages: BannerMessage[] = data.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await runBannerDirector(callGateway, company, researchContext, messages);

      // 8. Débito de quota apenas ao gerar prompts finais
      if (!result.needsMoreInfo && result.promptOptions?.length === 2) {
        const limitCheck = await checkAiLimitAndIncrement(context.supabase, context.userId);
        if (!limitCheck.allowed) {
          return { success: false, data: null, error: limitCheck.error || "Limite de IA atingido." };
        }
        if (limitCheck.increment) {
          const commit = await limitCheck.increment();
          if (!commit.allowed) {
            return { success: false, data: null, error: commit.error || "Erro ao processar cota." };
          }
        }
      }

      return { success: true, data: { ...result, brief: activeBrief }, error: null };
    } catch (e: any) {
      if (e instanceof BannerDirectorError) {
        console.error("[BannerAgent] Director error:", e.code);
        if (e.code === "BANNER_QUALITY") {
          return {
            success: false,
            data: null,
            error: "Não foi possível gerar um banner que atenda todos os critérios de qualidade. Tente novamente.",
          };
        }
        return {
          success: false,
          data: null,
          error: "Ocorreu um erro técnico ao processar sua solicitação.",
          code: e.code,
        };
      }
      console.error("[BannerAgent] Internal Error:", e.message, e.stack);
      return {
        success: false,
        data: null,
        error: "Ocorreu um erro técnico ao processar sua solicitação.",
        code: "IA-EB3D7B68",
      };
    }
  });
