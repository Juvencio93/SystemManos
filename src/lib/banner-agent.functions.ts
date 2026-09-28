import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callGateway } from "@/lib/ai.server";
import { parseBannerResponse, safeBriefingFallbackQuestion } from "@/lib/banner-response";
import {
  createVisualSceneContract,
  commercialStateFromBrief,
  extractBannerTurnFacts,
  formatOfferPrice,
  rebuildBannerConversationBrief,
  isResolvedQuestion,
  nextCommercialQuestion,
  normalizeCurrencyCopy,
  pendingQuestionForCommercialState,
  physicalElementGroundingRule,
  requiredOfferFactsFromBrief,
  validateGeneratedCommercialFacts,
  validateSecondPromptCommercialDirection,
  validatePromptVisualGrounding,
  validatePromptTemporalFacts,
} from "@/lib/banner-brief";
import { classifyBannerCompatibility } from "@/lib/banner-compatibility";
import type { BannerConversationBrief } from "@/lib/banner-brief";

const BannerMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

function safeBannerOptions(
  facts: { items: string[]; price?: number; priceUnit?: string; business?: string },
  context?: { segment?: string; hasVisualEvidence?: boolean },
) {
  const items = facts.items.filter(Boolean).join(" + ") || "a oferta informada";
  const price = facts.price !== undefined ? `R$ ${facts.price.toFixed(2).replace(".", ",")}` : "o valor informado";
  const unit = facts.priceUnit ? ` (${facts.priceUnit})` : "";
  const base = `${items} por ${price}${unit}`;
  const business = facts.business ? ` para ${facts.business}` : "";
  const segment = context?.segment && !/^outro$/iu.test(context.segment.trim())
    ? `, respeitando o posicionamento de ${context.segment}`
    : "";
  const visual = context?.hasVisualEvidence
    ? " Aplicar as cores, materiais e elementos visuais confirmados na pesquisa pública da empresa; não inventar elementos fora dessas referências."
    : " Usar fotografia gastronômica realista em composição de estúdio neutro, sem simular fachada ou interior não confirmado.";
  return [
    { title: "Oferta em destaque", prompt: `Criar um banner promocional horizontal 16:9 para ${business || "o estabelecimento"}${segment}, destacando “${items}” por “${price}${unit}”. Mostrar visualmente todos os itens em uma composição gastronômica apetitosa e realista, com hierarquia clara: oferta no maior destaque, produtos em segundo plano e marca apenas quando confirmada no cadastro. Usar tipografia grande, legível e alto contraste; não incluir datas, ingredientes, endereço ou condições não informados.${visual}` },
    { title: "Composição alternativa", prompt: `Criar uma segunda opção realmente diferente de banner horizontal 16:9 para ${business || "o estabelecimento"}${segment}, mantendo exatamente “${items}” e “${price}${unit}”. Alterar o enquadramento para uma cena de mesa com os produtos em primeiro plano, preço em selo ou faixa de destaque e texto curto. Todos os itens devem aparecer na imagem e a leitura deve funcionar em celular. Não adicionar informações comerciais não confirmadas.${visual}` },
  ];
}

function enrichBannerPromptOptions(
  options: Array<{ title: string; prompt: string }>,
  facts: { business?: string },
  context: { segment?: string; hasVisualEvidence?: boolean },
) {
  const business = facts.business ? `Nome da empresa: ${facts.business}.` : "Usar o nome da empresa confirmado no cadastro.";
  const segment = context.segment && !/^outro$/iu.test(context.segment.trim())
    ? ` Ramo: ${context.segment}.`
    : "";
  const visual = context.hasVisualEvidence
    ? " Aplicar a identidade visual confirmada na pesquisa pública (logo, paleta, materiais e estilo), sem inventar elementos." 
    : " Usar a identidade visual do cadastro e solicitar a logo original quando ela não estiver disponível; não inventar cores ou fachada.";
  return options.slice(0, 2).map((option, index) => {
    const cleanPrompt = option.prompt
      .replace(/\bpara\s+da\s+/giu, "para ")
      .replace(/\brespeitando o posicionamento de Outro,?\s*/giu, "");
    const direction = index === 0
      ? "Direção 1: composição editorial com área de texto à esquerda, produtos em destaque à direita e preço em bloco de alto contraste."
      : "Direção 2: composição fotográfica de mesa vista em três quartos, produtos em primeiro plano, preço em selo e hierarquia visual diferente da primeira opção.";
    return {
      ...option,
      title: index === 0 ? "Identidade da marca" : "Composição alternativa",
      prompt: `${cleanPrompt.trim()} ${business}${segment}${visual} ${direction}`.trim(),
    };
  });
}

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
      priceUnit: z.string().optional(),
      priceCandidate: z.number().finite().optional(),
      commercialCondition: z.string().optional(),
      freeCopyConfirmed: z.boolean().optional(),
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

function missingOfferDetails(messages: Array<z.infer<typeof BannerMessageSchema>>) {
  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  const asksForHappyHour = /\bhappy\s*hour\b/.test(userText);
  const asksForPromotion = /\b(promo(?:c|ç)[aã]o|oferta|combo|desconto|por\s+pessoa)\b/.test(
    userText,
  );
  const asksForBanner = /\b(banner|cartaz|arte|divulga(?:r|ção)|anúncio|anuncio)\b/.test(userText);
  if (!asksForPromotion && !asksForBanner) return null;

  // "Promoção da semana" sozinho descreve apenas o tipo de peça, não a
  // oferta. Sem um produto/serviço explícito, a IA não pode inventar itens
  // (como "cesta" ou "vitrine") a partir do segmento da empresa.
  const hasOfferSubject =
    /\b(bolo|café|cafe|pizza|hamb(?:ú|u)rg(?:uer|er)|lanche|prato|porção|porcao|bebida|curso|serviço|servico|produto|combo|menu|refeição|refeicao|sobremesa|desconto|brinde|ingresso|mensalidade|plano)\b/.test(
      userText,
    );
  if (!hasOfferSubject) {
    return "Entendi 😊 Qual produto, serviço ou condição você quer destacar no banner?";
  }

  const hasSchedule =
    /\b(?:das?\s*)?\d{1,2}(?::|h)\d{0,2}\s*(?:[àa]\s*|[-–]\s*)\d{1,2}(?::|h)\d{0,2}\s*h?\b|\b(?:a partir de|às|as)\s+\d{1,2}(?::|h)\d{0,2}\s*h?\b/.test(
      userText,
    );
  // Aceita formas naturais como "valor de 12 reais", "por R$ 12" e
  // "preço: 12", sem exigir que o número venha imediatamente após o termo.
  const hasPrice =
    /(?:r\$|\bvalor\b|\bpre[cç]o\b|\bpor\b)(?:\s*[:=]|\s+de)?\s*r?\$?\s*\d/.test(userText) ||
    // O cliente também pode informar somente “12 reais”, “12 pila” ou
    // “12 money”. Nesse caso o número + unidade monetária é suficiente para
    // reconhecer que o preço já foi informado.
    /\d+(?:[.,]\d{1,2})?\s*(?:r\$|reais?|pila|money)(?:\b|\s|$)/.test(userText);
  const hasValidity =
    /\b(?:válid[ao]|valido|vigência|vigencia|somente|apenas|de segunda|segunda|terça|terca|quarta(?:[ -]?feira)?|quinta(?:[ -]?feira)?|sexta(?:[ -]?feira)?|sábado|sabado|domingo|esta semana|essa semana|durante a semana|até|ate|entre|das?)\b/.test(
      userText,
    );
  const hasPriceUnit =
    /\b(por\s+pessoa|por\s+por[çc][aã]o|por\s+unidade|total|cada|inclui|incluso|inclusa)\b/.test(
      userText,
    ) ||
    // Uma composição explícita (“uma fatia + café”, “pedaço de bolo”,
    // “combo”) já esclarece a unidade da oferta e não deve gerar a mesma
    // pergunta novamente.
    /(fatia|fatias|pedaço|pedaços|bolo|café|cafe|combo|porção|porcao|copo|taça|taca|garrafa|lata|unidade|550\s*ml)/.test(
      userText,
    );
  const missing: string[] = [];
  // Only ask for a schedule when the user actually requested a happy hour.
  // A generic promotion (e.g. “promoção da semana”) must use the scanned
  // company context and proceed without inventing or forcing a happy-hour flow.
  if (asksForHappyHour && !hasSchedule) missing.push("qual é o horário do happy hour");
  if (asksForPromotion && !hasPrice) missing.push("qual é o valor da oferta");
  if (hasPrice && !hasPriceUnit)
    missing.push("se o valor é por pessoa, porção ou o total da oferta");
  if (asksForPromotion && !hasValidity)
    missing.push("se é válida durante toda a semana ou em dias específicos");

  return missing.length > 0
    ? `Antes de gerar os dois prompts, preciso confirmar ${missing.join(" e ")}.`
    : null;
}

export type BannerAgentResponse =
  | {
      success: true;
      data: {
        needsMoreInfo: boolean;
        question: string | null;
        promptOptions: { title: string; prompt: string }[] | null;
        reminder: string | null;
        brief?: {
          subject?: string | undefined;
          offerItems?: string[] | undefined;
          price?: number | undefined;
          priceCandidate?: number | undefined;
          commercialCondition?: string | undefined;
          validity?: string | undefined;
          weekday?: string | undefined;
          weekdays?: string[] | undefined;
          dateContext?: "this" | "next" | undefined;
          recurrence?: "NONE" | "WEEKLY" | undefined;
          unit?: string | undefined;
          time?: string | undefined;
          scopeConfirmed?: boolean | undefined;
          pendingQuestion?:
            | "subject"
            | "offer_scope_confirmation"
            | "offer_scope_correction"
            | "price_confirmation"
            | "business_compatibility_confirmation"
            | undefined;
        };
      };
      error: null;
    }
  | { success: false; data: null; error: string; code?: string };

/**
 * Production turn orchestrator. Kept pure so the multi-turn contract can be
 * integration-tested without a gateway or a serverless runtime.
 */
export function resolveBannerConversationTurn(
  previousBrief: BannerConversationBrief,
  userMessages: readonly string[],
) {
  const activeBrief = rebuildBannerConversationBrief(previousBrief, userMessages);
  const comboNamed = /\bcombo\b/iu.test(userMessages.join("\n"));
  const normalizedBrief = comboNamed
    ? { ...activeBrief, scopeConfirmed: true, pendingQuestion: undefined }
    : activeBrief;
  const state = commercialStateFromBrief(normalizedBrief, userMessages);
  const nextQuestion = nextCommercialQuestion(userMessages, normalizedBrief);
  const pendingQuestion = nextQuestion
    ? pendingQuestionForCommercialState(userMessages, normalizedBrief)
    : undefined;
  const brief = pendingQuestion ? { ...normalizedBrief, pendingQuestion } : normalizedBrief;
  return {
    brief,
    state,
    newFacts: userMessages.length
      ? extractBannerTurnFacts(userMessages[userMessages.length - 1] ?? "", previousBrief)
      : {},
    nextQuestion,
  };
}

function logBannerParseFailure(
  requestId: string,
  phase: "briefing_decision" | "prompt_generation",
  failure: Exclude<ReturnType<typeof parseBannerResponse>, { ok: true }>,
) {
  // The model output is truncated and logged server-side only. Never log the
  // gateway authorization header or any environment variable.
  console.error("[BannerAgent] AI response contract failure", {
    requestId,
    phase,
    stage: failure.stage,
    detail: failure.detail,
    rawPreview: failure.rawPreview,
  });
}

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

      // Reject exhausted accounts before any provider call. The successful
      // generation is still debited only at the end of this handler.
      const { checkAiLimitAndIncrement } = await import("@/lib/ai-limits.server");
      const aiEligibility = await checkAiLimitAndIncrement(context.supabase, context.userId);
      if (!aiEligibility.allowed) {
        return {
          success: false,
          data: null,
          error: aiEligibility.error || "Limite de IA atingido.",
        };
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

      // A pesquisa externa faz parte da leitura inicial de CADA turno. Assim,
      // mesmo a primeira pergunta do assistente nasce depois de ele consultar
      // cadastro + fontes públicas da empresa, em vez de tratar o negócio como
      // um ramo genérico. O resultado é reaproveitado na geração final, sem
      // uma segunda consulta e sem permitir que a pesquisa substitua fatos
      // comerciais informados pelo usuário.
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
      const initialResearch = needsCompanyEnvironmentResearch(researchProfile)
        ? await searchCompanyEnvironment(researchProfile)
        : null;
      let environmentResearchContext = initialResearch?.verified
        ? `Pesquisa externa verificada nesta conversa. Use somente estas referências públicas confirmadas:\n\n${initialResearch.context}`
        : "A pesquisa externa não encontrou correspondência visual confiável. Use somente o cadastro e as informações confirmadas pelo usuário; para imagem, não simule o local.";

      // O briefing é vivo: o modelo recebe o cadastro e TODO o histórico e
      // decide semanticamente se falta algo essencial. Não usamos uma lista
      // fixa de campos obrigatórios por segmento.
      const chatHistory = data.messages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");
      const userMessages = data.messages
        .filter((message) => message.role === "user")
        .map((message) => message.content);
      // The client sends the active structured brief on every turn. Replaying
      // the complete user history only adds explicitly mentioned facts; it can
      // never erase a value because a later message omits it.
      const turn = resolveBannerConversationTurn(data.brief, userMessages);
      const activeBrief = turn.brief;
      const beforeState = commercialStateFromBrief(data.brief, userMessages.slice(0, -1));
      const afterState = turn.state;
      const comboWithPrice =
        /\bcombo\b/iu.test(userMessages.join("\n")) &&
        (afterState.hasPrice || activeBrief.priceCandidate !== undefined);
      const deterministicComplete =
        !turn.nextQuestion && afterState.hasSubject && (afterState.hasPrice || comboWithPrice) && (afterState.hasConfirmedScope || comboWithPrice);
      const compatibility = classifyBannerCompatibility(
        {
          name: snapshot.name,
          segment: snapshot.business_segment,
          description: snapshot.business_description,
          location: [snapshot.city, snapshot.state].filter(Boolean).join(", "),
        },
        activeBrief.subject,
      );
      if (compatibility.classification === "STRONG_MISMATCH") {
        const brief = {
          ...activeBrief,
          // An incompatible registered business is not a confirmation step.
          // Keep the subject open so the user can replace it with a request
          // that belongs to the company currently selected in the system.
          pendingQuestion: "subject" as const,
        };
        console.info("[BannerAgent] business compatibility", {
          classification: compatibility.classification,
          reason: compatibility.reason,
        });
        return {
          success: true,
          data: {
            needsMoreInfo: true,
            question: `Não consigo criar um banner de ${activeBrief.subject} porque o cadastro de ${snapshot.name} indica ${snapshot.business_segment}. Envie uma promoção relacionada ao ramo cadastrado.`,
            promptOptions: null,
            reminder: null,
            brief,
          },
          error: null,
        };
      }
      const requestTrace = {
        requestId: crypto.randomUUID(),
        conversationId: data.conversationId,
        turnNumber: userMessages.length,
        before: beforeState,
        newFacts: turn.newFacts,
        afterMerge: afterState,
      };
      console.info("[BannerAgent] conversation trace", requestTrace);
      // When the structured conversation already knows what is missing, do
      // not delegate that decision to the model. This keeps the assistant
      // responsive, avoids wasting gateway calls and prevents malformed JSON
      // from replacing a precise contextual question.
      const latestUserMessage = userMessages.at(-1) ?? "";
      const answeredScopeWithCombo =
        (/^\s*(?:combo|oferta\s+completa|completa|completo|combo\s+completo)\s*[.!]?\s*$/iu.test(latestUserMessage) ||
          /^\s*(?:sim|isso|correto|exato|confirmo|pode\s+ser)\b.*\b(?:combo|oferta completa|completa|completo)\b/iu.test(latestUserMessage)) &&
        (activeBrief.price !== undefined || activeBrief.priceCandidate !== undefined);
      const requiredQuestion = answeredScopeWithCombo || comboWithPrice ? undefined : turn.nextQuestion;
      if (requiredQuestion) {
        return {
          success: true,
          data: {
            needsMoreInfo: true,
            question: requiredQuestion,
            promptOptions: null,
            reminder: null,
            brief: activeBrief,
          },
          error: null,
        };
      }
      const groundingDirective = physicalElementGroundingRule();
      const briefingDecisionSystem = `${BANNER_SYSTEM}\n\n${groundingDirective}\n\nMODO BRIEFING: ainda não gere prompts. Analise cadastro e histórico como um diretor criativo. Extraia internamente objetivo, produto/serviço, oferta, preço, unidade, período, horário e público somente quando presentes. Não invente fatos nem repita perguntas já respondidas. Faça perguntas em português simples e natural, usando o ramo e o produto do cliente quando isso ajudar; nunca diga “briefing”, “escopo”, “referências confirmadas” ou “organizar informações”. Se houver ambiguidade comercial real, retorne needsMoreInfo=true com UMA pergunta humana, contextual e curta. Se o briefing for suficiente, retorne needsMoreInfo=false, promptOptions=null e question=null.`;
      const briefingDecision = await callGateway(
        `${briefingDecisionSystem}\n\nCONTEXTO OFICIAL DA EMPRESA:\n${companyCtx}\n\nCOMPATIBILIDADE DO PEDIDO: ${compatibility.classification}. ${compatibility.reason} Segmento é contexto, não whitelist; extensões plausíveis devem seguir normalmente.`,
        `Histórico completo da conversa:\n${chatHistory}\n\nResponda apenas com o JSON obrigatório.`,
      );
      if (!briefingDecision.ok || !briefingDecision.text) {
        return {
          success: false,
          data: null,
          error: briefingDecision.error || "Erro na comunicação com a IA.",
        };
      }
      const decision = parseBannerResponse(briefingDecision.text);
      if (!decision.ok) {
        logBannerParseFailure(briefingDecision.requestId, "briefing_decision", decision);
        const lastUserMessage =
          [...data.messages].reverse().find((message) => message.role === "user")?.content ?? "";
        return {
          success: true,
          data: {
            needsMoreInfo: true,
            question: turn.nextQuestion ?? safeBriefingFallbackQuestion(lastUserMessage),
            promptOptions: null,
            reminder: null,
          },
          error: null,
        };
      }
      if (
        decision.data.needsMoreInfo &&
        !deterministicComplete &&
        !answeredScopeWithCombo &&
        !isResolvedQuestion(decision.data.question, userMessages, activeBrief)
      ) {
        console.info("[BannerAgent] conversation decision", {
          ...requestTrace,
          modelProposedQuestion: decision.data.question,
          finalDecision: decision.data.question,
          persistedState: activeBrief,
        });
        return {
          success: true,
          data: { ...decision.data, promptOptions: null, brief: activeBrief },
          error: null,
        };
      }

      // A mesma pesquisa que contextualizou o atendimento é a referência
      // definitiva para a arte. Isso preserva coerência entre a conversa e os
      // prompts e evita chamadas duplicadas ao Tavily no mesmo turno.
      const hasConfirmedVisualEvidence = initialResearch?.hasVisualEvidence === true;
      environmentResearchContext = initialResearch?.verified
        ? `Validação da empresa concluída antes desta resposta. Use somente estas referências públicas confirmadas:\n\n${initialResearch.context}`
        : "A pesquisa não encontrou correspondência visual confiável. Use fundo neutro/estúdio e não simule o local.";

      // Identity evidence returned by Tavily is not automatically visual
      // evidence of an interior. Only an explicit visual/material reference
      // may widen the contract beyond a neutral presentation.
      const visualSceneContract = createVisualSceneContract(
        hasConfirmedVisualEvidence ? "CONFIRMED" : "UNCONFIRMED",
      );
      const requiredOfferFacts = requiredOfferFactsFromBrief(activeBrief, snapshot.name);
      const userExplicitlyRequestedBottomTextBand = userMessages.some((message) =>
        /\b(?:faixa|banda|barra)\s+(?:inferior|na base|na parte inferior)\b/iu.test(message),
      );
      const commercialContractDirective = [
        "CONTRATO COMERCIAL OBRIGATÓRIO:",
        `itens visuais obrigatórios nas DUAS opções: ${requiredOfferFacts.items.join(" | ") || "nenhum item confirmado"}.`,
        requiredOfferFacts.price !== undefined
          ? `preço obrigatório: ${formatOfferPrice(requiredOfferFacts.price)}.`
          : "",
        requiredOfferFacts.priceUnit ? `base do preço obrigatória: ${requiredOfferFacts.priceUnit}.` : "",
        requiredOfferFacts.validity ? `validade obrigatória: ${requiredOfferFacts.validity}.` : "",
        requiredOfferFacts.weekday
          ? `dia obrigatório: ${requiredOfferFacts.weekday}; recorrência: ${requiredOfferFacts.recurrence === "WEEKLY" ? "semanal explicitamente informada" : "NÃO informada — jamais escreva toda/todos/semanal/semanalmente"}.`
          : "",
        requiredOfferFacts.unit ? `unidade/escopo obrigatório: ${requiredOfferFacts.unit}.` : "",
        `empresa obrigatória: ${requiredOfferFacts.business ?? "conforme cadastro"}.`,
        "A diferença criativa pode mudar somente câmera, composição, luz, tipografia e apresentação não contraditória; nunca pode remover, adicionar ou trocar um item comercial.",
        "Em CADA promptOption, devolva também visualItems (itens que aparecem visualmente) e commercialFacts { items, price, validity, unit, business, scope }. Esses metadados não são texto da arte e precisam refletir exatamente o contrato; scope deve ser confirmed ou corrected.",
        "A resposta será rejeitada se algum item existir apenas no texto e não em visualItems.",
      ]
        .filter(Boolean)
        .join(" ");
      const sceneContractDirective = [
        "CONTRATO VISUAL OBRIGATÓRIO:",
        `status do ambiente: ${visualSceneContract.environmentStatus}.`,
        `ambientes permitidos: ${visualSceneContract.allowedEnvironment.join(", ")}.`,
        visualSceneContract.forbiddenAssumptions.length
          ? `suposições proibidas: ${visualSceneContract.forbiddenAssumptions.join(", ")}.`
          : "use somente a evidência visual confirmada.",
        hasConfirmedVisualEvidence
          ? "Cada opção deve traduzir pelo menos uma EVIDÊNCIA VISUAL CONFIRMADA da pesquisa em uma característica observável da cena. Não basta citar a marca, a cidade, a paleta ou o logotipo."
          : "Não alegue fidelidade ao local: mantenha a cena em estúdio neutro e recomende foto real quando a fidelidade ao ambiente for importante.",
        "O contrato será validado localmente; uma opção fora dele será rejeitada.",
      ].join(" ");

      // 3. Prepare AI Prompt with the scanned company context
      const systemPrompt = `${BANNER_SYSTEM}\n\n${groundingDirective}\n\n${sceneContractDirective}\n\n${commercialContractDirective}\n\nCONTEXTO OFICIAL DA EMPRESA:\n${companyCtx}\n\nCOMPATIBILIDADE DO PEDIDO: ${compatibility.classification}. ${compatibility.reason} Segmento é contexto, não whitelist; não bloqueie extensões plausíveis.\n\nPESQUISA EXTERNA SOBRE O AMBIENTE:\n${environmentResearchContext}`;
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
        const parsedResponse = parseBannerResponse(aiResponse.text);
        if (!parsedResponse.ok) {
          logBannerParseFailure(aiResponse.requestId, "prompt_generation", parsedResponse);
          const lastUserMessage =
            [...data.messages].reverse().find((message) => message.role === "user")?.content ?? "";
          return {
            success: true,
            data: {
              needsMoreInfo: true,
              question: safeBriefingFallbackQuestion(lastUserMessage),
              promptOptions: null,
              reminder: null,
            },
            error: null,
          };
        }
        const validated = parsedResponse.data;
        let normalized =
          !validated.needsMoreInfo && validated.promptOptions
            ? {
                ...validated,
                promptOptions: validated.promptOptions.map((option) => ({
                  ...option,
                  prompt: normalizeCurrencyCopy(option.prompt),
                })),
              }
            : validated;

        // Deterministic enforcement: prompts are inspected after generation,
        // not merely instructed. An invalid option is never returned; one
        // corrective generation receives the exact contract and is validated
        // again before it can proceed.
        const violations =
          !normalized.needsMoreInfo && normalized.promptOptions
            ? normalized.promptOptions.flatMap((option, index) =>
                [
                  ...validatePromptVisualGrounding(option.prompt, visualSceneContract),
                  ...validatePromptTemporalFacts(option.prompt, requiredOfferFacts),
                  ...validateGeneratedCommercialFacts(option, requiredOfferFacts),
                  ...(index === 1
                    ? validateSecondPromptCommercialDirection(
                        option.prompt,
                        userExplicitlyRequestedBottomTextBand,
                      )
                    : []),
                ].map((violation) => ({ ...violation, option: index + 1 })),
              )
            : [];

        if (violations.length > 0) {
          const correction = await callGateway(
            `${systemPrompt}\n\nCORREÇÃO DETERMINÍSTICA: reescreva integralmente as duas opções para cumprir os CONTRATOS VISUAL E COMERCIAL. Como o ambiente não foi confirmado, use exclusivamente composição de produto em fundo neutro de estúdio, backdrop abstrato mínimo ou superfície neutra de apoio. Não mencione nem represente loja, balcão, vitrine, fachada, interior, salão, estabelecimento, arquitetura ou ambiente comercial. Preserve todos os itens, preço, validade, empresa e escopo confirmados em cada opção, incluindo visualItems e commercialFacts completos. Retorne somente o JSON obrigatório, sem perguntas.`,
            `Resposta rejeitada pelo validador local: ${JSON.stringify(violations)}\n\nResposta a corrigir:\n${JSON.stringify(normalized)}`,
          );
          if (!correction.ok || !correction.text) {
            return {
              success: true,
              data: {
                needsMoreInfo: false,
                question: null,
                promptOptions: safeBannerOptions(requiredOfferFacts, {
                  segment: snapshot.business_segment ?? undefined,
                  hasVisualEvidence: initialResearch?.hasVisualEvidence === true,
                }),
                reminder: "As opções preservam os itens e o valor informados.",
                brief: activeBrief,
              },
              error: null,
            };
          }
          const corrected = parseBannerResponse(correction.text);
          if (!corrected.ok || corrected.data.needsMoreInfo || !corrected.data.promptOptions) {
            if (!corrected.ok)
              logBannerParseFailure(correction.requestId, "prompt_generation", corrected);
            return {
              success: true,
              data: {
                needsMoreInfo: false,
                question: null,
                promptOptions: safeBannerOptions(requiredOfferFacts, {
                  segment: snapshot.business_segment ?? undefined,
                  hasVisualEvidence: initialResearch?.hasVisualEvidence === true,
                }),
                reminder: "As opções preservam os itens e o valor informados.",
                brief: activeBrief,
              },
              error: null,
            };
          }
          const correctedOptions = corrected.data.promptOptions.map((option) => ({
            ...option,
            prompt: normalizeCurrencyCopy(option.prompt),
          }));
          const correctionViolations = correctedOptions.flatMap((option, index) =>
            [
              ...validatePromptVisualGrounding(option.prompt, visualSceneContract),
              ...validatePromptTemporalFacts(option.prompt, requiredOfferFacts),
              ...validateGeneratedCommercialFacts(option, requiredOfferFacts),
              ...(index === 1
                ? validateSecondPromptCommercialDirection(
                    option.prompt,
                    userExplicitlyRequestedBottomTextBand,
                  )
                : []),
            ].map((violation) => ({ ...violation, option: index + 1 })),
          );
          if (correctionViolations.length > 0) {
            console.error("[BannerAgent] Visual grounding correction rejected", {
              requestId: correction.requestId,
              violations: correctionViolations,
            });
            return {
              success: true,
              data: {
                needsMoreInfo: false,
                question: null,
                promptOptions: safeBannerOptions(requiredOfferFacts, {
                  segment: snapshot.business_segment ?? undefined,
                  hasVisualEvidence: initialResearch?.hasVisualEvidence === true,
                }),
                reminder: "As opções preservam os itens e o valor informados.",
                brief: activeBrief,
              },
              error: null,
            };
          }
          normalized = { ...corrected.data, promptOptions: correctedOptions };
        }

        if (!normalized.needsMoreInfo && normalized.promptOptions?.length) {
          normalized = {
            ...normalized,
            promptOptions: enrichBannerPromptOptions(normalized.promptOptions, requiredOfferFacts, {
              segment: snapshot.business_segment ?? undefined,
              hasVisualEvidence: initialResearch?.hasVisualEvidence === true,
            }),
          };
        }

        // 6. Quota Logic - Debit only on success (when prompts are generated)
        if (
          !normalized.needsMoreInfo &&
          normalized.promptOptions &&
          normalized.promptOptions.length === 2
        ) {
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
        console.info("[BannerAgent] conversation decision", {
          ...requestTrace,
          modelProposedQuestion: decision.data.question,
          finalDecision: "generate_prompts",
          persistedState: activeBrief,
        });
        return { success: true, data: { ...normalized, brief: activeBrief }, error: null };
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
