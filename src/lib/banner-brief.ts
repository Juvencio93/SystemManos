export type VisualConfidence = "confirmed" | "partial" | "unconfirmed";
export type BannerBrief = {
  objective?: "institutional" | "commercial";
  product?: string;
  offer?: string;
  price?: number;
  priceKind?: "fixed" | "from";
  unit?: string;
  day?: string;
  recurring?: boolean;
  time?: string;
  benefit?: string;
  visualConfidence: VisualConfidence;
  facts: Record<string, string | number | boolean>;
};

export const createBrief = (): BannerBrief => ({ visualConfidence: "unconfirmed", facts: {} });

export type SemanticFacts = Partial<Omit<BannerBrief, "visualConfidence" | "facts">>;

// Pure merge: new semantic facts replace prior facts, retaining the active
// briefing as the only source of truth used for the next decision.
export function mergeBrief(previous: BannerBrief, facts: SemanticFacts): BannerBrief {
  const next = { ...previous, ...facts };
  const { facts: _previousFacts, ...briefFacts } = next;
  return {
    ...next,
    facts: Object.fromEntries(
      Object.entries(briefFacts).filter(([, value]) => value != null),
    ) as Record<string, string | number | boolean>,
  };
}

export function normalizePrice(text: string): number | undefined {
  const matches = [
    ...text
      .toLowerCase()
      .matchAll(
        /(?:r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?)|(?:\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais?|pila|money)\b)/g,
      ),
  ];
  const match = matches.at(-1);
  if (!match) {
    const fallback = [
      ...text.toLowerCase().matchAll(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\b/g),
    ].at(-1);
    if (!fallback?.[1]) return undefined;
    return Number(`${fallback[1].replace(/\./g, "")}.${(fallback[2] || "0").padEnd(2, "0")}`);
  }
  const integer = match[1] ?? match[3];
  if (!integer) return undefined;
  return Number(`${integer.replace(/\./g, "")}.${(match[2] || match[4] || "0").padEnd(2, "0")}`);
}

/** Formats a confirmed numeric price for display in the generated artwork. */
export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00a0/g, " ");
}

/** A zero-value commercial offer is communicated as a benefit, never as R$ 0,00. */
export function formatOfferPrice(value: number) {
  return value === 0 ? "GRÁTIS" : formatBRL(value);
}

/**
 * Currency symbols already identify the unit. Keeping a following "real" or
 * "reais" duplicates the information ("R$ 15,00 reais"), so remove only
 * that redundant suffix without changing the number or any commercial fact.
 */
export function normalizeCurrencyCopy(copy: string) {
  const withoutRedundantSuffix = copy.replace(
    /(R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s+reais?\b/gi,
    "$1",
  );

  return withoutRedundantSuffix.replace(
    /(^|[^\w$])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais?|pila|money)\b/gi,
    (_match, prefix: string, integer: string, decimals: string | undefined) => {
      const normalized = Number(
        `${integer.replace(/\./g, "")}.${(decimals || "0").padEnd(2, "0")}`,
      );
      return `${prefix}${formatBRL(normalized)}`;
    },
  );
}

const EXPLICIT_VALIDITY =
  /\b(?:v[áa]lid[ao]|vig[êe]ncia|at[ée]\s+(?:[a-zá-ú]+|\d{1,2})|somente|apenas|todos?\s+os?|toda\s+(?:a\s+)?(?:quarta|quinta|sexta|segunda|ter[çc]a|semana)|durante\s+(?:a\s+)?semana|(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira)?s?\b|de\s+\w+\s+(?:a|at[ée])\s+\w+)/i;

const TEMPORAL_COMMERCIAL_REQUEST =
  /\b(?:promo[çc][ãa]o\s+(?:da|de|para)\s+semana|promo[çc][ãa]o\s+semanal|oferta\s+da\s+semana|evento|festival|happy\s*hour)\b/i;
const INSTITUTIONAL_REQUEST = /\b(?:banner|imagem|arte)\s+institucional\b|\binstitucional\b/i;

/**
 * Commercial completeness is intentionally narrow: a period is necessary
 * only when the request itself establishes a temporary promotion/event.
 * Institutional and permanent communications remain free of this question.
 */
export function commercialCompletenessQuestion(messages: readonly string[]) {
  const conversation = messages.join("\n");
  if (!TEMPORAL_COMMERCIAL_REQUEST.test(conversation) || EXPLICIT_VALIDITY.test(conversation)) {
    return null;
  }

  return "Fechado 😄 Até quando essa promoção é válida?";
}

export type VisualSceneContract = {
  environmentStatus: "CONFIRMED" | "UNCONFIRMED";
  allowedEnvironment: readonly string[];
  forbiddenAssumptions: readonly string[];
};

/**
 * A search result that identifies the business is not, by itself, visual
 * evidence of its interior. Until a real visual reference is confirmed, the
 * prompt is constrained to a neutral presentation instead of a fictional
 * version of the establishment.
 */
export function createVisualSceneContract(
  environmentStatus: VisualSceneContract["environmentStatus"],
): VisualSceneContract {
  return environmentStatus === "CONFIRMED"
    ? {
        environmentStatus,
        allowedEnvironment: ["evidência visual confirmada", "suporte técnico mínimo"],
        forbiddenAssumptions: [],
      }
    : {
        environmentStatus,
        allowedEnvironment: [
          "fundo neutro de estúdio",
          "backdrop abstrato mínimo",
          "superfície neutra de apoio",
        ],
        forbiddenAssumptions: ["ambiente arquitetônico ou comercial não confirmado"],
      };
}

export type VisualGroundingViolation = {
  phrase: string;
  reason: "UNCONFIRMED_ENVIRONMENT";
};

// These expressions describe generic kinds of environmental assumptions. They
// are deliberately independent from a business segment, product, or city.
const UNCONFIRMED_ENVIRONMENT_PATTERNS = [
  /\b(?:interior|fachada|arquitetura|ambiente|canto)\s+(?:(?:[\p{L}]+)\s+){0,2}(?:da|do|de|em)\s+[^,. ;]+/giu,
  /\b(?:janela|balc[aã]o|vitrine|sal[aã]o|loja|estabelecimento)\b/gi,
  /\b(?:caf[eé]|cafeteria|padaria|restaurante|oficina)\s+(?:interior|real|f[ií]sica)\b/gi,
  /\b(?:mesa|superf[ií]cie|cen[aá]rio)\s+(?:r[uú]stic[oa]|tem[aá]tic[oa]|acolhedor(?:a)?)\b/gi,
];

/** Deterministic final gate: no unconfirmed environment reaches the user. */
export function validatePromptVisualGrounding(
  prompt: string,
  contract: VisualSceneContract,
): VisualGroundingViolation[] {
  if (contract.environmentStatus === "CONFIRMED") return [];

  const violations = new Map<string, VisualGroundingViolation>();
  for (const pattern of UNCONFIRMED_ENVIRONMENT_PATTERNS) {
    for (const match of prompt.matchAll(pattern)) {
      const phrase = match[0]?.trim();
      if (phrase)
        violations.set(phrase.toLocaleLowerCase("pt-BR"), {
          phrase,
          reason: "UNCONFIRMED_ENVIRONMENT",
        });
    }
  }
  return [...violations.values()];
}

export type ConversationCommercialState = {
  hasSubject: boolean;
  hasPrice: boolean;
  hasValidity: boolean;
  hasConfirmedScope: boolean;
  isSingleService: boolean;
};

/**
 * Scope is inferred only when the wording binds the price to the offer with
 * enough commercial certainty. This is deliberately separate from visual or
 * segment rules: a question is useful only when a different interpretation
 * would materially change the advertised offer.
 */
export type CommercialScopeConfidence = "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE";

/**
 * Serialized with every request so the banner dialog has no dependency on
 * process memory. An omitted field means "not mentioned this turn"; only an
 * explicit new fact may replace a confirmed one.
 */
export type BannerConversationBrief = {
  subject?: string | undefined;
  /** Individual commercial items, kept separately from the free-form subject. */
  offerItems?: string[] | undefined;
  price?: number | undefined;
  /** Bare values such as "35" stay pending until the user confirms that they are the offer price. */
  priceCandidate?: number | undefined;
  commercialCondition?: string | undefined;
  /** A finite validity window such as "até domingo" or "setembro". */
  validity?: string | undefined;
  /** The explicitly named day, kept separate from recurrence. */
  weekday?: string | undefined;
  /** Every explicitly named day; weekday remains the first for compatibility. */
  weekdays?: string[] | undefined;
  dateContext?: "this" | "next" | undefined;
  recurrence?: "NONE" | "WEEKLY" | undefined;
  unit?: string | undefined;
  time?: string | undefined;
  scopeConfirmed?: boolean | undefined;
  compatibilityConfirmed?: boolean | undefined;
  pendingQuestion?:
    | "subject"
    | "offer_scope_confirmation"
    | "offer_scope_correction"
    | "price_confirmation"
    | "business_compatibility_confirmation"
    | undefined;
};

export type BannerTurnFacts = Partial<BannerConversationBrief>;

function normalizedWords(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The user may describe a combo in ordinary prose. We retain its individual
 * commercial identities so a later scope correction can remove or keep an
 * item without losing price or validity.
 */
export function extractOfferItems(subject: string | undefined) {
  if (!subject) return [];
  return subject
    .split(/\s*(?:\+|\be\b|\bmais\b|,(?!\d{1,2}\b))\s*/iu)
    .map((item) =>
      item
        .trim()
        .replace(
          /^.*?\b(?:promo(?:[çc][aã]o)?|oferta)\s+(?:da\s+)?(?:semana|especial)\s*:\s*/iu,
          "",
        )
        .replace(/\s+(?:por\s+)?(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money)\b.*$/iu, "")
        .replace(/^\s*(?:um(?:a)?|o|a|os|as)\s+/iu, "")
        .trim(),
    )
    .filter((item) => item.length > 1 && !/^(?:at[ée]|v[áa]lid)/iu.test(item));
}

const COMMERCIAL_SUBJECT =
  /\b(?:banner|arte|imagem|divulga(?:r|ção)|promo(?:ç|c)[aã]o|oferta|combo|desconto|happy\s*hour|por\s+r?\$|pre[cç]o|valor)\b/iu;
const EVENT_OR_OFFER_SUBJECT =
  /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial|rod[ií]zio|degusta[çc][aã]o)\b/iu;
const PRICE_MENTION =
  /(?:r\$\s*\d|\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money)\b|\b(?:valor|pre[cç]o)\s*(?:de|:)?\s*r?\$?\s*\d|\b(?:gr[aá]tis|gratuita?|sem\s+custo|por\s+conta\s+da\s+casa)\b)/iu;
const SCOPE_CONFIRMATION =
  /\b(?:mesma\s+(?:promo[çc][aã]o|oferta)|combo\s+(?:completo|inclui)|inclui\s+(?:o|a|os|as)|valor\s+(?:do|da)\s+(?:combo|oferta))\b/i;

const FREE_OFFER = /\b(?:gr[aá]tis|gratuita?|sem\s+custo|por\s+conta\s+da\s+casa)\b/iu;
const PRICE_FACT = /(?:r\$\s*\d|\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money)\b|\b(?:valor|pre[cç]o)\b[^\d]{0,24}\d)/i;
const BARE_PRICE = /^\s*\d{1,6}(?:[.,]\d{1,2})?\s*$/u;

function extractPriceFact(message: string) {
  if (FREE_OFFER.test(message)) return 0;
  if (!PRICE_FACT.test(message)) return undefined;
  return normalizePrice(message);
}

function extractBarePriceCandidate(message: string) {
  if (FREE_OFFER.test(message) || !BARE_PRICE.test(message)) return undefined;
  return normalizePrice(message);
}

function extractValidityFact(message: string) {
  // A weekday is scheduling information, never recurrence or a validity
  // window by itself. Keep finite windows here only.
  const match = message.match(
    /\b(?:at[ée]\s+[\p{L}\d-]+|v[áa]lid[ao]\s+(?:at[ée]\s+)?[\p{L}\d-]+)\b/iu,
  );
  if (match?.[0]) return match[0];
  const weekend = message.match(/\b(?:(?:neste|nesse|deste|esse)\s+)?fim\s+de\s+semana\b/iu);
  if (weekend?.[0]) return weekend[0];
  const week = message.match(/\b(?:para|durante|esta|essa)\s+(?:a\s+)?semana\b/iu);
  if (week?.[0]) return week[0];
  return message.match(MONTH_FACT)?.[1];
}

const WEEKDAY_FACT = /\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-?feira)?s?\b/iu;
const WEEKDAY_FACTS =
  /\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-?feira)?s?\b/giu;
const MONTH_FACT =
  /\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/iu;

function normalizeWeekday(day: string) {
  const normalized = normalizedWords(day).replace(/s$/u, "");
  return ["segunda", "terca", "quarta", "quinta", "sexta"].includes(normalized)
    ? `${normalized === "terca" ? "terça" : normalized}-feira`
    : normalized === "sabado"
      ? "sábado"
      : normalized;
}

function extractWeekdayFacts(message: string) {
  return [...message.matchAll(WEEKDAY_FACTS)]
    .map((match) => (match[1] ? normalizeWeekday(match[1]) : undefined))
    .filter((day): day is string => Boolean(day))
    .filter((day, index, days) => days.indexOf(day) === index);
}

function extractDateContext(message: string): "this" | "next" | undefined {
  if (
    /\b(?:nesta|nessa|desta|esta)\s+(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)/iu.test(
      message,
    )
  )
    return "this";
  if (/\bpr[oó]xima\s+(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)/iu.test(message))
    return "next";
  return undefined;
}

function extractRecurrence(message: string): "NONE" | "WEEKLY" | undefined {
  if (!WEEKDAY_FACT.test(message)) return undefined;
  return /\b(?:todo(?:s|as)?|toda(?:s)?|semanal(?:mente)?|a\s+cada\s+semana)\b/iu.test(message)
    ? "WEEKLY"
    : "NONE";
}

function extractUnitFact(message: string) {
  return (
    message.match(
      /\bpor\s+(?:pessoa|por[çc][aã]o|unidade|item|casal|adulto|crian[çc]a)\b/iu,
    )?.[0] ?? message.match(/\b(?:cada)\s+(?:pessoa|unidade|item)\b/iu)?.[0]
  );
}

function extractTimeFact(message: string) {
  const match =
    message.match(/(?:^|[^\p{L}\d])(?:[àa]s|as)\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)?/iu) ??
    message.match(/\b(\d{1,2})h(\d{2})?\b/iu);
  const hour = match?.[1];
  if (!hour) return undefined;
  const minute = match?.[2] ?? match?.[3] ?? "00";
  const parsedHour = Number(hour);
  const parsedMinute = Number(minute);
  if (parsedHour > 23 || parsedMinute > 59) return undefined;
  return `${String(parsedHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
}

function extractCommercialCondition(message: string) {
  const percentage = message.match(/\b\d{1,3}\s*%\s*(?:de\s+)?desconto\b/iu);
  if (percentage) return percentage[0];
  return message.match(/\b(?:gr[aá]tis|gratuita?|sem\s+custo|por\s+conta\s+da\s+casa)\b/iu)?.[0];
}

function extractCommercialSubject(message: string) {
  if (/^\s*(?:o\s+)?(?:pre[cç]o|valor)\b/iu.test(message)) return undefined;
  if (
    /^\s*(?:(?:como\s+)?(?:criar|fazer|montar)\s+)?(?:um(?:a)?\s+)?(?:banner|arte|imagem)\s*(?:de\s+)?(?:uma?\s+)?(?:promo(?:ç|c)[aã]o|oferta)(?:\s+da\s+semana)?\s*$/iu.test(
      message,
    )
  )
    return undefined;
  const normalized = message
    .replace(
      /^\s*(?:(?:quero|queria|preciso|gostaria(?:\s+de)?|vamos)\s+)?(?:criar|fazer|faz|montar|divulgar)\s*(?:um[ao]?\s+)?(?:banner|arte|imagem)?\s*(?:de|para|pro|pra|sobre)?\s*/iu,
      "",
    )
    .replace(
      /^\s*(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-?feira)?\s+(?:vai\s+ter|tem)\s+/iu,
      "",
    )
    .replace(/^\s*(?:promo(?:ç|c)[aã]o|oferta)\s*:\s*/iu, "")
    .replace(/(?:por\s+)?r?\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?/giu, "")
    .replace(/\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*(?:reais?|pila|money)\b/giu, "")
    // "Avaliação gratuita" is the commercial subject itself and should stay
    // readable; standalone free-price expressions are conditions, not items.
    .replace(/\b(?:gr[aá]tis|sem\s+custo|por\s+conta\s+da\s+casa)\b/giu, "")
    .replace(
      /(?:,|\s)+(?:na\s+|nesta\s+|nessa\s+|dessa\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?(?:\s+por\s+(?:pessoa|por[çc][aã]o|unidade|item))?\s*$/iu,
      "",
    )
    .replace(
      /(?:,|\s)+(?:v[áa]lid[ao]\s+)?(?:at[ée]\s+\S+|somente\s+\S+|(?:(?:n[ao]|nessa|dessa|esta)\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?|(?:(?:neste|nesse|deste|esse)\s+)?fim\s+de\s+semana|durante\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))(?:\s+(?:[àa]s|as)\s*\d{1,2}(?::\d{2}|h(?:\d{2})?)?)?\s*$/iu,
      "",
    )
    .replace(
      /^\s*(?:v[áa]lid[ao]\s+)?(?:at[ée]\s+\S+|somente\s+\S+|(?:(?:n[ao]|nessa|dessa|esta)\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?|(?:(?:neste|nesse|deste|esse)\s+)?fim\s+de\s+semana|durante\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))\s*$/iu,
      "",
    )
    .replace(/\bpor\s*$/iu, "")
    .trim();
  return normalized.length >= 2 &&
    !/^(?:(?:como\s+)?(?:criar|fazer|montar)\s+)?(?:um(?:a)?\s+)?(?:banner|arte|imagem)(?:\s+de)?\s+(?:promo(?:ç|c)[aã]o|oferta)(?:\s+da\s+semana)?$/iu.test(
      normalized,
    ) &&
    !/^(?:promo(?:ç|c)[aã]o|oferta)(?:\s+da\s+semana)?$/iu.test(normalized)
    ? normalized
    : undefined;
}

/** Extract only facts explicitly stated in the current user turn. */
export function extractBannerTurnFacts(
  message: string,
  context?: Pick<BannerConversationBrief, "pendingQuestion" | "priceCandidate">,
): BannerTurnFacts {
  const facts: BannerTurnFacts = {};
  const price = extractPriceFact(message);
  if (price !== undefined) facts.price = price;
  const barePrice = extractBarePriceCandidate(message);
  if (barePrice !== undefined) facts.priceCandidate = barePrice;
  const commercialCondition = extractCommercialCondition(message);
  if (commercialCondition) facts.commercialCondition = commercialCondition;
  const validity = extractValidityFact(message);
  if (validity) facts.validity = validity;
  const weekdays = extractWeekdayFacts(message);
  if (weekdays.length) {
    facts.weekday = weekdays[0];
    facts.weekdays = weekdays;
    facts.recurrence = extractRecurrence(message) ?? "NONE";
  }
  const dateContext = extractDateContext(message);
  if (dateContext) facts.dateContext = dateContext;
  const unit = extractUnitFact(message);
  if (unit) facts.unit = unit;
  const time = extractTimeFact(message);
  if (time) facts.time = time;
  if (SCOPE_CONFIRMATION.test(message)) facts.scopeConfirmed = true;
  if (
    scopeCorrectionOperation(message) === "UNCLEAR" &&
    !/^\s*(?:sim|isso|pode ser|ok|certo)\b/i.test(message)
  ) {
    const subject = extractCommercialSubject(message);
    if (
      subject &&
      (COMMERCIAL_SUBJECT.test(message) ||
        EVENT_OR_OFFER_SUBJECT.test(message) ||
        PRICE_FACT.test(message) ||
        FREE_OFFER.test(message) ||
        context?.pendingQuestion === "subject")
    )
      facts.subject = subject;
    // When the previous turn explicitly asked what will be advertised, the
    // answer can be any product or service. Do not restrict that answer to a
    // catalog of known business words.
    if (
      !facts.subject &&
      !PRICE_FACT.test(message) &&
      context?.pendingQuestion === "subject" &&
      !/^\s*(?:vai|até|somente|apenas)\b/iu.test(message) &&
      !/\b(?:promo(?:ç|c)[aã]o|oferta)\s+(?:da|de)\s+semana\b/iu.test(message) &&
      message.trim().length >= 2
    )
      facts.subject = subject ?? message.trim();
  }
  return facts;
}

/**
 * Merge is intentionally null-safe. Undefined is NOT_MENTIONED and keeps the
 * active value; an explicit replacement (such as "na verdade é 17") wins.
 */
export function mergeBannerConversationBrief(
  previous: BannerConversationBrief,
  facts: BannerTurnFacts,
): BannerConversationBrief {
  const subject = facts.subject !== undefined ? facts.subject : previous.subject;
  return {
    ...previous,
    ...(facts.subject !== undefined ? { subject: facts.subject } : {}),
    ...(facts.subject !== undefined ? { offerItems: extractOfferItems(subject) } : {}),
    ...(facts.price !== undefined ? { price: facts.price } : {}),
    ...(facts.price !== undefined ? { priceCandidate: undefined } : {}),
    ...(facts.priceCandidate !== undefined ? { priceCandidate: facts.priceCandidate } : {}),
    ...(facts.commercialCondition !== undefined
      ? { commercialCondition: facts.commercialCondition }
      : {}),
    ...(facts.validity !== undefined ? { validity: facts.validity } : {}),
    ...(facts.weekday !== undefined ? { weekday: facts.weekday } : {}),
    ...(facts.weekdays !== undefined ? { weekdays: facts.weekdays } : {}),
    ...(facts.dateContext !== undefined ? { dateContext: facts.dateContext } : {}),
    ...(facts.recurrence !== undefined ? { recurrence: facts.recurrence } : {}),
    ...(facts.unit !== undefined ? { unit: facts.unit } : {}),
    ...(facts.time !== undefined ? { time: facts.time } : {}),
    ...(facts.scopeConfirmed !== undefined ? { scopeConfirmed: facts.scopeConfirmed } : {}),
    ...(facts.subject !== undefined ? { pendingQuestion: undefined } : {}),
  };
}

type ConfirmationIntent = "positive" | "negative" | "unknown";
type ScopeCorrectionOperation =
  "CONFIRM_ALL" | "KEEP_ONLY" | "REMOVE" | "ADD" | "REJECT_ALL" | "UNCLEAR";

function confirmationIntent(message: string): ConfirmationIntent {
  const normalized = message.trim().toLocaleLowerCase("pt-BR");
  if (/^(?:n[aã]o\b|negativ|incorret|diferent|jamais\b)/i.test(normalized)) return "negative";
  if (
    /^(?:sim\b|isso\b|corret|exat|confirm|pode ser\b|perfeit|claro\b|afirmativ)/i.test(normalized)
  )
    return "positive";
  return "unknown";
}

function itemMatchesDescription(item: string, description: string) {
  const itemWords = normalizedWords(item)
    .split(" ")
    .filter((word) => word.length > 2);
  const descriptionWords = normalizedWords(description)
    .split(" ")
    .filter((word) => word.length > 2);
  return descriptionWords.length > 0 && descriptionWords.some((word) => itemWords.includes(word));
}

function referencedOfferItems(items: readonly string[], message: string) {
  const normalized = normalizedWords(message);
  const ordinal = /\b(?:primeiro|primeira)\b/.test(normalized)
    ? 0
    : /\b(?:segundo|segunda)\b/.test(normalized)
      ? 1
      : /\b(?:ultimo|ultima)\b/.test(normalized)
        ? items.length - 1
        : undefined;
  if (ordinal !== undefined) return items[ordinal] ? [items[ordinal]] : [];

  const descriptiveReference = message.match(
    /\b(?:s[oó]|somente|apenas|fica|sem|tira|remove|retira|exclu(?:i|a)|n[aã]o\s+inclui|n[aã]o\s+tem)\s+(.+)/iu,
  )?.[1];
  return descriptiveReference
    ? items.filter((item) => itemMatchesDescription(item, descriptiveReference))
    : [];
}

function scopeCorrectionOperation(message: string): ScopeCorrectionOperation {
  const normalized = normalizedWords(message);
  if (confirmationIntent(message) === "positive") return "CONFIRM_ALL";
  if (
    /\b(?:coloca|adiciona|acrescenta|poe|inclui)\b/.test(normalized) &&
    /\b(?:de volta|tambem|tambem)\b/.test(normalized)
  )
    return "ADD";
  if (/\b(?:s[oó]|somente|apenas|fica)\b/.test(normalized)) return "KEEP_ONLY";
  if (
    /\b(?:sem|tira|remove|retira|exclui|nao inclui|nao tem)\b/.test(normalized) ||
    /\b(?:primeiro|segundo|ultimo)\s+nao\b/.test(normalized)
  ) {
    return "REMOVE";
  }
  if (confirmationIntent(message) === "negative") return "REJECT_ALL";
  return "UNCLEAR";
}

function correctedOfferItems(brief: BannerConversationBrief, message: string) {
  const items = brief.offerItems?.length ? brief.offerItems : extractOfferItems(brief.subject);
  if (!items.length) return [];
  const operation = scopeCorrectionOperation(message);
  const referenced = referencedOfferItems(items, message);
  if (operation === "KEEP_ONLY") return referenced;
  if (operation === "REMOVE") {
    const remaining = items.filter((item) => !referenced.includes(item));
    return remaining.length && remaining.length < items.length ? remaining : [];
  }
  if (operation === "ADD") {
    const addition = message
      .replace(/^\s*(?:na verdade\s*)?(?:coloca|adiciona|acrescenta|poe|põe|inclui)\s+/iu, "")
      .replace(/\b(?:de volta|tamb[eé]m)\b.*$/iu, "")
      .replace(/^\s*(?:o|a|os|as)\s+/iu, "")
      .trim();
    return addition.length > 1 && !items.some((item) => sameCommercialItem(item, addition))
      ? [...items, addition]
      : items;
  }
  return [];
}

function briefWithCorrectedOfferItems(brief: BannerConversationBrief, message: string) {
  const items = correctedOfferItems(brief, message);
  if (!items.length) return brief;
  return {
    ...brief,
    subject: items.join(" e "),
    offerItems: items,
    scopeConfirmed: true,
    pendingQuestion: undefined,
  };
}

/** Resolve an answer against its semantic pending type, never by display text. */
export function resolvePendingBannerQuestion(
  brief: BannerConversationBrief,
  message: string,
): BannerConversationBrief {
  if (!brief.pendingQuestion) return brief;
  if (brief.pendingQuestion === "price_confirmation") {
    const candidate = extractBarePriceCandidate(message);
    if (candidate !== undefined)
      return { ...brief, priceCandidate: candidate, pendingQuestion: "price_confirmation" };
    if (confirmationIntent(message) === "positive" && brief.priceCandidate !== undefined)
      return {
        ...brief,
        price: brief.priceCandidate,
        priceCandidate: undefined,
        pendingQuestion: undefined,
      };
    if (confirmationIntent(message) === "negative")
      return { ...brief, priceCandidate: undefined, pendingQuestion: "price_confirmation" };
    return brief;
  }
  if (brief.pendingQuestion === "business_compatibility_confirmation") {
    if (confirmationIntent(message) === "positive")
      return { ...brief, compatibilityConfirmed: true, pendingQuestion: undefined };
    return brief;
  }
  if (brief.pendingQuestion === "offer_scope_confirmation") {
    const operation = scopeCorrectionOperation(message);
    if (operation === "CONFIRM_ALL") {
      return { ...brief, scopeConfirmed: true, pendingQuestion: undefined };
    }

    // A negative clarification may narrow the offer without discarding price
    // or validity already confirmed in previous turns. An explicit correction
    // resolves the semantic question; a bare "não" advances to a different,
    // useful correction question instead of repeating the confirmation.
    const corrected = briefWithCorrectedOfferItems(brief, message);
    if (corrected !== brief) return corrected;
    if (operation === "UNCLEAR") return brief;
    const { scopeConfirmed: _scopeConfirmed, ...withoutScope } = brief;
    return { ...withoutScope, pendingQuestion: "offer_scope_correction" };
  }
  return brief;
}

function sourceMentionsPriceBeforeItsLastOfferConnector(source: string) {
  const priceIndex = source.search(PRICE_FACT);
  const connectors = [...source.matchAll(/\+|\be\b/giu)];
  const lastConnector = connectors.at(-1);
  return priceIndex >= 0 && lastConnector !== undefined && priceIndex < (lastConnector.index ?? 0);
}

/**
 * Decide whether a multi-item price naturally belongs to the whole offer.
 * Commas alone remain cautious because they can be a catalogue, while an
 * explicit combo, "+", or joined items followed by the price is reliable.
 */
export function commercialScopeConfidence(
  brief: BannerConversationBrief,
  messages: readonly string[],
): CommercialScopeConfidence {
  const items = brief.offerItems?.length ? brief.offerItems : extractOfferItems(brief.subject);
  if (items.length <= 1 || brief.scopeConfirmed) return "HIGH_CONFIDENCE";

  // Messages already contain the subject in the normal flow. Do not prepend
  // it again: duplicating a one-turn offer would make a later connector look
  // as though it appeared after the price and create a false ambiguity.
  const source = messages.join("\n") || brief.subject || "";
  const normalized = normalizedWords(source);
  if (/\bcombo\b|\b(?:juntos?|inclui|completo)\b/.test(normalized)) return "HIGH_CONFIDENCE";
  if (sourceMentionsPriceBeforeItsLastOfferConnector(source)) return "LOW_CONFIDENCE";
  if (/\+/.test(source)) return "HIGH_CONFIDENCE";

  // "bolo e café" followed by "15 pila" in the next turn is still a
  // natural description of one offer. A comma-separated catalogue is not.
  if (/\be\b/iu.test(source) && (!/,/.test(brief.subject ?? "") || /\+/.test(source)))
    return "HIGH_CONFIDENCE";
  return "MEDIUM_CONFIDENCE";
}

function inferScopeWhenConfident(brief: BannerConversationBrief, messages: readonly string[]) {
  const items = brief.offerItems?.length ? brief.offerItems : extractOfferItems(brief.subject);
  return !brief.pendingQuestion &&
    !brief.scopeConfirmed &&
    items.length > 1 &&
    commercialScopeConfidence(brief, messages) === "HIGH_CONFIDENCE"
    ? { ...brief, scopeConfirmed: true, pendingQuestion: undefined }
    : brief;
}

/** Rebuild the brief from full history while preserving the client-held brief. */
export function rebuildBannerConversationBrief(
  previous: BannerConversationBrief,
  messages: readonly string[],
): BannerConversationBrief {
  const hasActiveBrief = Object.values(previous).some((value) => value !== undefined);
  if (hasActiveBrief) {
    // The persisted brief is authoritative. Only the new turn can amend it;
    // replaying older messages would let stale text replace a later correction.
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return previous;
    const resolved = resolvePendingBannerQuestion(previous, latestMessage);
    const merged = mergeBannerConversationBrief(
      resolved,
      extractBannerTurnFacts(latestMessage, resolved),
    );
    // Corrections such as "sem o café" are valid even when no scope question
    // was needed. Apply them to the live brief before any derivative is built.
    const corrected = ["REMOVE", "KEEP_ONLY", "ADD"].includes(
      scopeCorrectionOperation(latestMessage),
    )
      ? briefWithCorrectedOfferItems(merged, latestMessage)
      : merged;
    return inferScopeWhenConfident(corrected, messages);
  }

  // First request / recovery path: rebuild from the supplied full history.
  const rebuilt = messages.reduce(
    (brief, message) => mergeBannerConversationBrief(brief, extractBannerTurnFacts(message, brief)),
    previous,
  );
  return inferScopeWhenConfident(rebuilt, messages);
}

export function commercialStateFromBrief(
  brief: BannerConversationBrief,
  messages: readonly string[],
): ConversationCommercialState {
  const conversation = messages.join("\n");
  const hasSubject = Boolean(brief.subject);
  const isSingleService =
    /\b(?:troca\s+de\s+[\p{L}]+|servi[çc]o\s+de\s+[\p{L}]+)/iu.test(conversation) &&
    !/\s\+\s|\be\s+(?:um|uma|o|a)\b/i.test(conversation);
  const itemCount = brief.offerItems?.length
    ? brief.offerItems.length
    : extractOfferItems(brief.subject).length;
  return {
    hasSubject,
    hasPrice: brief.price !== undefined,
    hasValidity: Boolean(brief.validity || brief.weekday),
    hasConfirmedScope: brief.scopeConfirmed === true || isSingleService || itemCount <= 1,
    isSingleService,
  };
}

export function hasExplicitValidity(messages: readonly string[]) {
  return EXPLICIT_VALIDITY.test(messages.join("\n"));
}

export function deriveConversationCommercialState(
  messages: readonly string[],
): ConversationCommercialState {
  const brief = rebuildBannerConversationBrief({}, messages);
  return commercialStateFromBrief(brief, messages);
}

/**
 * The deterministic state gate owns only factual commercial completeness.
 * CTA and visual preferences intentionally never block a usable banner.
 */
export function nextCommercialQuestion(
  messages: readonly string[],
  brief?: BannerConversationBrief,
) {
  const conversation = messages.join("\n");
  if (INSTITUTIONAL_REQUEST.test(conversation)) return null;
  const activeBrief = brief ?? rebuildBannerConversationBrief({}, messages);
  if (activeBrief.pendingQuestion === "offer_scope_correction") {
    return activeBrief.price !== undefined
      ? `Entendi. O ${formatOfferPrice(activeBrief.price)} vale só para qual item da oferta?`
      : "Entendi. O valor vale só para qual item da oferta?";
  }
  const state = commercialStateFromBrief(activeBrief, messages);
  const temporal =
    TEMPORAL_COMMERCIAL_REQUEST.test(conversation) ||
    /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial)\b/iu.test(activeBrief.subject ?? "");
  if (!state.hasSubject)
    return "Entendi 😊 Qual produto, serviço ou condição você quer destacar no banner?";
  if (activeBrief.priceCandidate !== undefined)
    return `Você quer usar ${formatBRL(activeBrief.priceCandidate)} como o valor da oferta no banner?`;
  if (temporal && !state.hasValidity) {
    const label = /\bfestival\b/iu.test(activeBrief.subject ?? "") ? "Esse festival" : "Essa promoção";
    return `${label} acontece em um dia específico, durante a semana ou em algum período definido?`;
  }
  if (!state.hasPrice) return "Qual é o valor exato da oferta?";
  if (!state.hasConfirmedScope && !state.isSingleService) {
    const items = activeBrief.offerItems?.length
      ? activeBrief.offerItems
      : extractOfferItems(activeBrief.subject);
    const price = activeBrief.price !== undefined ? formatOfferPrice(activeBrief.price) : "Esse valor";
    if (items.length === 2) return `${price} são pelo ${items[0]} com ${items[1]} juntos?`;
    return `${price} vale pelo combo todo ou por item?`;
  }
  return null;
}

export function pendingQuestionForCommercialState(
  messages: readonly string[],
  brief: BannerConversationBrief,
) {
  const conversation = messages.join("\n");
  if (INSTITUTIONAL_REQUEST.test(conversation)) return undefined;
  if (brief.pendingQuestion === "offer_scope_correction") return "offer_scope_correction" as const;
  const state = commercialStateFromBrief(brief, messages);
  const temporal =
    TEMPORAL_COMMERCIAL_REQUEST.test(conversation) ||
    /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial)\b/iu.test(brief.subject ?? "");
  if (!state.hasSubject) return "subject" as const;
  if (temporal && !state.hasValidity) return undefined;
  if (brief.priceCandidate !== undefined || !state.hasPrice) return "price_confirmation" as const;
  if (!state.hasConfirmedScope && !state.isSingleService)
    return "offer_scope_confirmation" as const;
  return undefined;
}

export type RequiredOfferFacts = {
  items: string[];
  price?: number;
  validity?: string;
  weekday?: string;
  recurrence?: "NONE" | "WEEKLY";
  unit?: string;
  business?: string;
  scope: "confirmed";
};

export type CommercialFactViolation = {
  reason:
    | "MISSING_VISUAL_METADATA"
    | "MISSING_OFFER_ITEM"
    | "EXTRA_OFFER_ITEM"
    | "WRONG_PRICE"
    | "MISSING_VALIDITY"
    | "MISSING_UNIT"
    | "INVENTED_RECURRENCE"
    | "WRONG_BUSINESS"
    | "WRONG_SCOPE";
  detail: string;
};

export type GeneratedCommercialMetadata = {
  visualItems?: readonly string[] | undefined;
  commercialFacts?:
    | {
        items?: readonly string[] | undefined;
        price?: number | undefined;
        validity?: string | undefined;
        unit?: string | undefined;
        business?: string | undefined;
        scope?: "confirmed" | "corrected" | undefined;
      }
    | undefined;
};

export function requiredOfferFactsFromBrief(
  brief: BannerConversationBrief,
  business?: string,
): RequiredOfferFacts {
  return {
    items: brief.offerItems?.length ? brief.offerItems : extractOfferItems(brief.subject),
    ...(brief.price !== undefined ? { price: brief.price } : {}),
    ...(brief.validity ? { validity: brief.validity } : {}),
    ...(brief.weekday ? { weekday: brief.weekday } : {}),
    ...(brief.recurrence ? { recurrence: brief.recurrence } : {}),
    ...(brief.unit ? { unit: brief.unit } : {}),
    ...(business ? { business } : {}),
    scope: "confirmed",
  };
}

function sameCommercialItem(left: string, right: string) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Final commercial gate. `visualItems` makes the product representation
 * inspectable separately from the artwork copy, so writing “+ café” in text
 * cannot hide the fact that the coffee was omitted from the composition.
 */
export function validateGeneratedCommercialFacts(
  generated: GeneratedCommercialMetadata,
  required: RequiredOfferFacts,
): CommercialFactViolation[] {
  const violations: CommercialFactViolation[] = [];
  const visualItems = generated.visualItems;
  const facts = generated.commercialFacts;
  if (!visualItems?.length || !facts?.items?.length) {
    return [
      {
        reason: "MISSING_VISUAL_METADATA",
        detail: "visualItems e commercialFacts.items são obrigatórios",
      },
    ];
  }
  for (const item of required.items) {
    if (
      !visualItems.some((candidate) => sameCommercialItem(candidate, item)) ||
      !facts.items.some((candidate) => sameCommercialItem(candidate, item))
    ) {
      violations.push({
        reason: "MISSING_OFFER_ITEM",
        detail: `Item obrigatório ausente: ${item}`,
      });
    }
  }
  for (const item of [...visualItems, ...facts.items]) {
    if (!required.items.some((requiredItem) => sameCommercialItem(item, requiredItem))) {
      violations.push({ reason: "EXTRA_OFFER_ITEM", detail: `Item não confirmado: ${item}` });
    }
  }
  if (required.price !== undefined && facts.price !== required.price) {
    violations.push({
      reason: "WRONG_PRICE",
      detail: `Preço deve ser ${formatOfferPrice(required.price)}`,
    });
  }
  if (
    required.validity &&
    normalizedWords(facts.validity ?? "") !== normalizedWords(required.validity)
  ) {
    violations.push({
      reason: "MISSING_VALIDITY",
      detail: `Validade deve ser ${required.validity}`,
    });
  }
  if (required.unit && normalizedWords(facts.unit ?? "") !== normalizedWords(required.unit)) {
    violations.push({ reason: "MISSING_UNIT", detail: `Unidade deve ser ${required.unit}` });
  }
  if (
    required.business &&
    normalizedWords(facts.business ?? "") !== normalizedWords(required.business)
  ) {
    violations.push({ reason: "WRONG_BUSINESS", detail: `Empresa deve ser ${required.business}` });
  }
  if (facts.scope !== "confirmed" && facts.scope !== "corrected") {
    violations.push({ reason: "WRONG_SCOPE", detail: "Escopo comercial precisa ser confirmado" });
  }
  return violations;
}

/** Reject weekly wording unless the user explicitly established a recurrence. */
export function validatePromptTemporalFacts(
  prompt: string,
  required: RequiredOfferFacts,
): CommercialFactViolation[] {
  if (required.recurrence !== "NONE") return [];
  const normalized = normalizedWords(prompt);
  const weekday = normalizedWords(required.weekday ?? "");
  if (
    weekday &&
    new RegExp(
      `\\b(?:toda|todo|todos|todas|semanal|semanalmente)\\s+${weekday.replace(" feira", "(?: feira)?")}\\b`,
      "iu",
    ).test(normalized)
  ) {
    return [
      {
        reason: "INVENTED_RECURRENCE",
        detail: `Recorrência não foi informada; preserve somente ${required.weekday}`,
      },
    ];
  }
  return [];
}

export type CommercialDirectionViolation = {
  reason: "GENERIC_OPTION_2_LAYOUT";
  detail: string;
};

/**
 * The second route must be commercially clear without falling into the
 * default flyer template (a full-width bottom strip with centered copy).
 * A client may explicitly request that treatment; otherwise it is rejected
 * and the gateway receives a corrective pass with a more editorial layout.
 */
export function validateSecondPromptCommercialDirection(
  prompt: string,
  allowBottomTextBand = false,
): CommercialDirectionViolation[] {
  if (allowBottomTextBand) return [];
  const normalized = normalizedWords(prompt);
  const usesBottomBand =
    /\b(?:faixa|banda|barra)\s+(?:inferior|na base|na parte inferior)\b/u.test(normalized) ||
    /\b(?:faixa|banda|barra)\s+de\s+texto\b/u.test(normalized);
  const centersCopy = /\b(?:texto|tipografia|informacoes)\s+centralizad[ao]s?\b/u.test(normalized);
  if (usesBottomBand || (centersCopy && /\b(?:faixa|banda|barra)\b/u.test(normalized))) {
    return [
      {
        reason: "GENERIC_OPTION_2_LAYOUT",
        detail:
          "A opção 2 não pode usar faixa inferior/de base ou texto centralizado como layout-padrão; use grade editorial assimétrica e tipografia integrada à composição.",
      },
    ];
  }
  return [];
}

export function isResolvedQuestion(
  question: string,
  messages: readonly string[],
  brief?: BannerConversationBrief,
) {
  const state = brief
    ? commercialStateFromBrief(brief, messages)
    : deriveConversationCommercialState(messages);
  const normalized = question.toLocaleLowerCase("pt-BR");
  if (/\b(?:validade|v[aá]lid|at[eé]\s+quando|per[ií]odo)\b/.test(normalized))
    return state.hasValidity;
  if (/\b(?:pre[cç]o|valor|r\$|pila|reais?)\b/.test(normalized)) return state.hasPrice;
  if (/\b(?:itens|mesma\s+(?:promo[çc][aã]o|oferta)|combo|oferta\s+completa)\b/.test(normalized))
    return state.hasConfirmedScope;
  if (/\b(?:empresa|estabelecimento|nome\s+da\s+(?:empresa|loja))\b/.test(normalized)) return true;
  if (/\b(?:produto|servi[çc]o)\b/.test(normalized)) return state.hasSubject;
  // A CTA is optional unless the user expressly asks for one, so it can never
  // become a mandatory missing-field question.
  if (/\bcta\b|chamada\s+para\s+a[cç][aã]o/.test(normalized)) return true;
  return false;
}

export type PhysicalElementOrigin =
  | "USER_REQUESTED"
  | "PRODUCT_INTRINSIC"
  | "BUSINESS_CONFIRMED"
  | "REFERENCE_CONFIRMED"
  | "TAVILY_CONFIRMED"
  | "TECHNICALLY_NECESSARY"
  | "UNVERIFIED_DECORATION";

export type PhysicalElement = {
  name: string;
  origin: PhysicalElementOrigin;
};

export function keepGroundedPhysicalElements(elements: readonly PhysicalElement[]) {
  return elements.filter((element) => element.origin !== "UNVERIFIED_DECORATION");
}

/**
 * Shared art-direction rule. It is provenance-based rather than a blacklist:
 * a physical element is admissible only when its source is known; otherwise
 * it is discarded as unverified decoration.
 */
export function physicalElementGroundingRule() {
  return [
    "Cada elemento físico deve ter uma origem explícita: USER_REQUESTED, PRODUCT_INTRINSIC, BUSINESS_CONFIRMED, REFERENCE_CONFIRMED, TAVILY_CONFIRMED ou TECHNICALLY_NECESSARY.",
    "PRODUCT_INTRINSIC autoriza somente o produto anunciado, não ingredientes ou objetos derivados usados como decoração.",
    "TECHNICALLY_NECESSARY permite somente uma superfície neutra mínima de estúdio quando indispensável para apresentar o produto.",
    "Descarte qualquer elemento classificado como UNVERIFIED_DECORATION; nome do segmento, ingrediente ou resultado de busca não autoriza props.",
  ].join(" ");
}

export function visualPolicy(confidence: VisualConfidence) {
  if (confidence === "confirmed")
    return "Use somente evidências visuais confirmadas do estabelecimento.";
  if (confidence === "partial")
    return "Use somente fatos confirmados; não simule interior ou fachada.";
  return "Use cenário neutro/estúdio; não simule fachada, interior ou ambiente do local; sugira foto real.";
}

export function sharedGroundTruth(brief: BannerBrief) {
  return {
    commercial: {
      product: brief.product,
      offer: brief.offer,
      price: brief.price,
      priceKind: brief.priceKind,
      unit: brief.unit,
      day: brief.day,
      recurring: brief.recurring,
      time: brief.time,
      benefit: brief.benefit,
    },
    visual: visualPolicy(brief.visualConfidence),
    restrictions: physicalElementGroundingRule(),
  };
}

export function shouldResearch(brief: BannerBrief) {
  return Boolean(brief.objective === "institutional" || brief.product || brief.offer);
}
