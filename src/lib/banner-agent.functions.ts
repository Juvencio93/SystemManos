import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGateway } from "@/lib/ai.server";

const BannerMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const BannerAgentInputSchema = z.object({
  messages: z.array(BannerMessageSchema),
  isFinalTurn: z.boolean(),
});

const BannerResponseSchema = z.object({
  needsMoreInfo: z.boolean(),
  question: z.string().nullable(),
  promptOptions: z
    .array(
      z.object({
        title: z.string(),
        prompt: z.string(),
      }),
    )
    .length(2)
    .nullable(),
  reminder: z.string().nullable(),
});

export type BannerAgentResponse =
  | { success: true; data: z.infer<typeof BannerResponseSchema>; error: null }
  | { success: false; data: null; error: string; code?: string };

export const askBannerAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => BannerAgentInputSchema.parse(input))
  .handler(async ({ context, data }): Promise<BannerAgentResponse> => {
    try {
      // 1. Resolve Context and Permissions using the centralized function
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

      // 2. Load Company Context before asking questions or generating prompts.
      // This guarantees that every turn starts with a fresh read of the Matriz
      // (and the current Filial, when applicable).
      const { computeCompanySnapshot, companyPrompt, BANNER_SYSTEM } =
        await import("@/lib/company.server");
      const { CompanySnapshotSchema } = await import("./utils/date-utils");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rawSnapshot = await computeCompanySnapshot(supabaseAdmin, companyId, branchId);
      const snapshot = CompanySnapshotSchema.parse(rawSnapshot);
      const companyCtx = companyPrompt(snapshot);

      // A pesquisa externa complementa apenas lacunas do cadastro. Ela nunca
      // substitui os dados oficiais nem autoriza inferir um ambiente pela cidade.
      let environmentResearchContext =
        "Nenhuma pesquisa externa necessária: use somente o cadastro e as informações confirmadas pelo usuário.";
      const { needsCompanyEnvironmentResearch, searchCompanyEnvironment } =
        await import("@/lib/tavily.server");
      const researchProfile = {
        name: snapshot.name,
        tradeName: snapshot.trade_name ?? null,
        legalName: snapshot.legal_name ?? null,
        segment: snapshot.business_segment ?? null,
        description: snapshot.business_description ?? null,
        address: snapshot.address ?? null,
        neighborhood: snapshot.neighborhood ?? null,
        city: snapshot.city ?? null,
        state: snapshot.state ?? null,
      };

      // 2.1. SEMPRE executa pesquisa: identifica ramo, ambiente, características reais.
      // Mesmo com descrição no cadastro, a pesquisa confirma informações atuais da empresa.
      const research = await searchCompanyEnvironment(researchProfile);

      // Constrói contexto de pesquisa com base no nível de confiança.
      if (research.confidence === "confirmado") {
        environmentResearchContext = `PESQUISA EXTERNA CONFIRMADA (confiança: CONFIRMADO):\nFontes públicas cuja identidade coincide com o cadastro. CUSTOMIZE a direção de arte com base no AMBIENTE, RAMO e CARACTERÍSTICAS REAIS — não genericize.\n\n${research.context}`;
      } else if (research.confidence === "parcial") {
        environmentResearchContext = `PESQUISA EXTERNA PARCIAL (confiança: PARCIAL):\nApenas uma fonte com correspondência parcial. Trate como indício: pode inspirar estilo/tom, mas não descreva fachada/interior/vista como confirmados. Use estúdio ou fundo neutro.\n\n${research.context}`;
      } else {
        environmentResearchContext =
          "PESQUISA EXTERNA NÃO CONFIRMADA (confiança: NÃO CONFIRMADO):\nNenhuma fonte pública encontrada. Não invente ambiente; use estúdio ou fundo neutro. Sugira fotos reais se precisar especificidade visual.";
      }

      // 3. Prepare AI Prompt with the scanned company context. The model
      // itself decides — turn by turn, from the full conversation and the
      // company context above — whether it already has enough information
      // or needs to ask exactly one contextual question, per the reasoning
      // order in BANNER_SYSTEM. No regex-based gate runs before this: a
      // fixed pattern match can't tell "35 pila" from "R$ 35,00", and it
      // ends up re-asking things the model already understood.
      const chatHistory = data.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

      const systemPrompt = `${BANNER_SYSTEM}\n\nCONTEXTO OFICIAL DA EMPRESA:\n${companyCtx}\n\nPESQUISA EXTERNA SOBRE O AMBIENTE:\n${environmentResearchContext}`;
      const userPrompt = `Histórico da conversa:\n${chatHistory}\n\nResponda apenas com o JSON conforme o formato obrigatório.`;

      // 4. Call AI (Dry Run - no quota yet)
      const aiResponse = await callGateway(systemPrompt, userPrompt);

      if (!aiResponse.ok || !aiResponse.text) {
        return {
          success: false,
          data: null,
          error: aiResponse.error || "Erro na comunicação com a IA.",
        };
      }

      // 5. Parse and Validate Response
      try {
        // Tenta encontrar o JSON no texto (DeepSeek pode retornar markdown)
        const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("[BannerAgent] JSON not found in response:", aiResponse.text);
          throw new Error("JSON not found in AI response");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const validated = BannerResponseSchema.parse(parsed);

        // 6. Quota Logic - Debit only on success (when prompts are generated)
        if (
          !validated.needsMoreInfo &&
          validated.promptOptions &&
          validated.promptOptions.length === 2
        ) {
          const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
          const limitCheck = await checkAiLimitAndIncrement(context.supabase, context.userId);

          if (!limitCheck.allowed) {
            return {
              success: false,
              data: null,
              error: limitCheck.error || "Limite de IA atingido.",
            };
          }

          if (limitCheck.increment) {
            const commit = await limitCheck.increment();
            if (!commit.allowed) {
              return {
                success: false,
                data: null,
                error: commit.error || "Erro ao processar cota.",
              };
            }
          }
        }

        // Return validated data
        return { success: true, data: validated, error: null };
      } catch (parseError: any) {
        console.error("[BannerAgent] Parse/Validation Error:", parseError.message, aiResponse.text);
        return {
          success: false,
          data: null,
          error: "Falha ao processar os dados da IA. Por favor, tente novamente.",
          code: "IA-PARSE-ERR",
        };
      }
    } catch (e: any) {
      console.error("[BannerAgent] Internal Error:", e.message, e.stack);
      return {
        success: false,
        data: null,
        error: "Ocorreu um erro técnico ao processar sua solicitação.",
        code: "IA-EB3D7B68",
      };
    }
  });

