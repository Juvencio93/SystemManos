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
  // Gírias de milhar: "2 barão" = R$ 2.000, "3 conto" = R$ 3.000.
  // Expande antes do parsing normal para reaproveitar toda a lógica.
  const withMilhar = text.replace(
    /\b(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:bar(?:ão|ao|ões|oes)|conto?s?)\b/gi,
    (_m, n: string) => `${Number(n.replace(/\./g, "")) * 1000} reais`,
  );
  const matches = [
    ...withMilhar
      .toLowerCase()
      .matchAll(
        /(?:r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?)|(?:\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b)/g,
      ),
  ];
  const match = matches.at(-1);
  if (!match) {
    const fallback = [
      ...withMilhar.toLowerCase().matchAll(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\b/g),
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
    /(^|[^\w$])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b/gi,
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
  /\b(?:promo[çc][ãa]o|oferta|desconto|cortesia|evento|festival|happy\s*hour)\b/iu;
const INSTITUTIONAL_REQUEST = /\b(?:banner|imagem|arte)\s+institucional\b|\binstitucional\b/i;
const EXPLICIT_PRICE_INTENT =
  /\b(?:promo(?:ç|c)[aã]o|oferta|desconto|pre[cç]o|valor|por\s+apenas|happy\s*hour)\b/iu;

/**
 * An explicit promotion/offer/event needs an end date or validity days before
 * copy generation. Institutional messages do not ask for campaign validity.
 */
export function commercialCompletenessQuestion(messages: readonly string[]) {
  const conversation = messages.join("\n");
  if (!TEMPORAL_COMMERCIAL_REQUEST.test(conversation) || EXPLICIT_VALIDITY.test(conversation)) {
    return null;
  }

  return "Fechado 😄 Até quando ou em quais dias essa promoção é válida?";
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
 *
 * Um item com preço individual. Usado quando o pedido tem múltiplos itens
 * com preços diferentes (ex: "salgadinhos 89,90 e bolo 35 o quilo").
 * Um item pode ser gratuito (price 0, "por conta da casa") enquanto outro
 * tem preço — cada item carrega sua própria condição comercial.
 */
export type PricedItem = {
  item: string;
  price: number;
  unit?: string | undefined;
};

export type BannerConversationBrief = {
  subject?: string | undefined;
  /** Individual commercial items, kept separately from the free-form subject. */
  offerItems?: string[] | undefined;
  /** Objetivo da peça (ex: "atrair clientes para a padaria", "divulgar evento"). */
  objective?: string | undefined;
  /** Textos que devem aparecer literalmente no banner. */
  mandatoryTexts?: string[] | undefined;
  price?: number | undefined;
  priceUnit?: string | undefined;
  /**
   * Preços por item. Quando presente com 2+ itens, é a fonte autoritativa de
   * preços (o `price`/`priceUnit` legado é ignorado). O legado continua
   * válido para ofertas de preço único.
   */
  pricedItems?: PricedItem[] | undefined;
  /** Bare values such as "35" stay pending until the user confirms that they are the offer price. */
  priceCandidate?: number | undefined;
  commercialCondition?: string | undefined;
  freeCopyConfirmed?: boolean | undefined;
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
  /** Marcado quando a pergunta proativa de data/dia já foi feita (evita repetir). */
  dateAsked?: boolean | undefined;
  pendingQuestion?:
    | "subject"
    | "objective"
    | "offer_scope_confirmation"
    | "offer_scope_correction"
    | "price_confirmation"
    | "date_confirmation"
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
        .replace(/^combo\s+com\s+/iu, "")
        .replace(
          /\s+(?:por\s+)?(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b.*$/iu,
          "",
        )
        .replace(/^\s*(?:um(?:a)?|o|a|os|as)\s+/iu, "")
        .trim(),
    )
    .filter(
      (item) =>
        item.length > 1 &&
        !/^(?:at[ée]|v[áa]lid)/iu.test(item) &&
        !/^(?:promo(?:ç|c)[aã]o|oferta)(?:\s+da\s+semana|\s+especial)?$/iu.test(item) &&
        !/^(?:toda|todo|todas|todos)?\s*(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?\b/iu.test(item) &&
        !/\bvalor\s+(?:de\s+)?\d/iu.test(item) &&
        !/v[áa]lid/iu.test(item),
    );
}

const COMMERCIAL_SUBJECT =
  /\b(?:banner|arte|imagem|divulga(?:r|ção)|promo(?:ç|c)[aã]o|oferta|combo|desconto|happy\s*hour|por\s+r?\$|pre[cç]o|valor)\b/iu;
const EVENT_OR_OFFER_SUBJECT =
  /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial|rod[ií]zio|degusta[çc][aã]o)\b/iu;
/**
 * Formas de dizer "grátis" que o cliente usa, numa fonte só reutilizada por
 * todos os extratores — nenhuma variação pode ficar de fora em um lugar e
 * dentro em outro. "na faixa" só vale como cortesia quando não vem seguida
 * de "de <número>" ("na faixa de 20 reais" é faixa de preço, não gratuidade).
 */
const FREE_WORDING_SOURCE = String.raw`gr[aá]tis|gratuit[oa]s?|sem\s+custo|por\s+conta\s+da\s+casa|de\s+graça|na\s+faixa(?!\s+de\s+\d)|sem\s+pagar\s+nada|a\s+casa\s+paga|cortesia`;
const PRICE_MENTION = new RegExp(
  String.raw`(?:r\$\s*\d|\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b|\b(?:valor|pre[cç]o)\s*(?:de|:)?\s*r?\$?\s*\d|\b(?:${FREE_WORDING_SOURCE})\b)`,
  "iu",
);
const SCOPE_CONFIRMATION =
  /\b(?:mesma\s+(?:promo[çc][aã]o|oferta)|combo\s*(?:completo|inclui)?|oferta\s+completa|oferta\s+completa|inclui\s+(?:o|a|os|as)|valor\s+(?:do|da)\s+(?:combo|oferta)|isso|sim|correto|exato|pode\s+ser|perfeito)\b/i;

const FREE_OFFER = new RegExp(`\\b(?:${FREE_WORDING_SOURCE})\\b`, "iu");
const NEGATED_FREE_OFFER = new RegExp(
  `\\b(?:n[aã]o|nunca|jamais)\\s+(?:[eé]\\s+)?(?:${FREE_WORDING_SOURCE})\\b|\\bsem\\s+cortesia\\b`,
  "iu",
);
const PRICE_FACT =
  /(?:r\$\s*\d|\d+(?:[.,]\d{1,2})?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b|\b(?:valor|pre[cç]o)\b[^\d]{0,24}\d)/i;
const BARE_PRICE = /^\s*\d{1,6}(?:[.,]\d{1,2})?\s*$/u;

function extractPriceFact(message: string) {
  if (FREE_OFFER.test(message) && !NEGATED_FREE_OFFER.test(message)) return 0;
  if (/\b\d+(?:[.,]\d{1,2})?\s*(?:(?:o|por)\s+)?(?:kg|quilo|kilo|quilograma)\b/iu.test(message))
    return normalizePrice(message);
  if (!PRICE_FACT.test(message)) return undefined;
  return normalizePrice(message);
}

function extractPriceUnit(message: string) {
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (/\b(?:kg|quilo|kilo|quilograma)\b/.test(normalized)) return "por quilo";
  if (/\b(?:unidade|unit[aá]rio|cada)\b/.test(normalized)) return "por unidade";
  if (/\b(?:combo|conjunto|oferta\s+completa|total)\b/.test(normalized)) return "oferta completa";
  if (/\bpor[cç][aã]o\b/.test(normalized)) return "por porção";
  return undefined;
}

type PriceOccurrence = { price: number; index: number; end: number };

/**
 * Encontra TODAS as ocorrências de preço na mensagem (numéricas + "por conta
 * da casa"/"grátis" como preço 0), com posições. Usado para pedidos com
 * múltiplos itens e preços diferentes — o `normalizePrice` pega só o último.
 */
function extractAllPriceOccurrences(message: string): PriceOccurrence[] {
  // Expande gírias de milhar antes, igual ao normalizePrice, para reaproveitar
  // a lógica. Os índices são relativos ao texto expandido.
  const withMilhar = message.replace(
    /\b(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:bar(?:ão|ao|ões|oes)|conto?s?)\b/gi,
    (_m, n: string) => `${Number(n.replace(/\./g, "")) * 1000} reais`,
  );
  const occurrences: PriceOccurrence[] = [];

  for (const m of withMilhar.matchAll(new RegExp(FREE_OFFER.source, "giu"))) {
    if (m.index === undefined) continue;
    const before = withMilhar.slice(Math.max(0, m.index - 30), m.index);
    if (NEGATED_FREE_OFFER.test(`${before} ${m[0]}`)) continue;
    occurrences.push({ price: 0, index: m.index, end: m.index + m[0].length });
  }

  const priceRe =
    /(?:r\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?)|(?:\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b)/g;
  for (const m of withMilhar.matchAll(priceRe)) {
    if (m.index === undefined) continue;
    const integer = m[1] ?? m[3];
    if (!integer) continue;
    occurrences.push({
      price: Number(`${integer.replace(/\./g, "")}.${(m[2] || m[4] || "0").padEnd(2, "0")}`),
      index: m.index,
      end: m.index + m[0].length,
    });
  }

  // Preços "nus" com decimal (ex: "89,90" sem "reais"): só valem quando a
  // mensagem já tem um preço explícito, para não capturar quantidades.
  // Exclui medidas imediatas ("2,5 kg").
  if (occurrences.length > 0) {
    const bareRe = /\b(\d{1,3}(?:\.\d{3})*),(\d{2})\b/g;
    for (const m of withMilhar.matchAll(bareRe)) {
      if (m.index === undefined || !m[1] || !m[2]) continue;
      if (occurrences.some((o) => m.index! >= o.index && m.index! < o.end)) continue;
      const after = withMilhar.slice(m.index + m[0].length, m.index + m[0].length + 10);
      if (/^\s*(?:kg|quilo|kilo|quilograma|g\b|ml|l\b|cm)\b/i.test(after)) continue;
      occurrences.push({
        price: Number(`${m[1].replace(/\./g, "")}.${m[2]}`),
        index: m.index,
        end: m.index + m[0].length,
      });
    }
  }

  const sorted = occurrences.sort((a, b) => a.index - b.index);
  // Remove sobreposições (ex: "grátis" dentro de um trecho já capturado).
  return sorted.filter((occ, i) => !sorted.slice(0, i).some((prev) => occ.index < prev.end));
}

/** Limpa o nome do item a partir do trecho de texto ao redor do preço. */
function cleanPricedItemSegment(segment: string): string {
  return (
    segment
      .replace(/(?:por\s+)?r?\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?/giu, "")
      .replace(
        /\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b/giu,
        "",
      )
      .replace(new RegExp(`\\b(?:${FREE_WORDING_SOURCE})\\b`, "giu"), "")
      // Preço "nu" com decimal, ex: "por 89,90".
      .replace(/(?:por\s+)?\b\d{1,3}(?:\.\d{3})*,\d{2}\b/giu, "")
      .replace(
        /\b(?:o|a|os|as)\s+(?:quilo|kilo|kg|quilograma|unidade|cada|por[çc][aã]o|pessoa)\b/giu,
        "",
      )
      // "centro de salgadinhos" = "cento (100) de salgadinhos"
      .replace(/^\s*centro\s+de\s+/iu, "")
      .replace(
        /^\s*(?:e|mais|\+|,|por|de|do|da|dos|das|o|a|os|as|um|uma|uns|umas|no|na|nos|nas)\s+/iu,
        "",
      )
      .replace(/\s*(?:e|mais|\+|,)\s*$/iu, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractUnitFromSegment(segment: string): string | undefined {
  const n = segment.toLocaleLowerCase("pt-BR");
  if (/\b(?:kg|quilo|kilo|quilograma)\b/.test(n)) return "quilo";
  if (/\b(?:unidade|unit[aá]rio|cada)\b/.test(n)) return "unidade";
  if (/\bpor[çc][aã]o\b/.test(n)) return "porção";
  if (/\bpessoa\b/.test(n)) return "pessoa";
  return undefined;
}

/**
 * Extrai itens com preços individuais de um pedido multi-preço.
 * Ex: "salgadinhos por 89,90 e 35 reais o quilo do bolo" →
 * [{ item: "salgadinhos", price: 89.9 }, { item: "bolo", price: 35, unit: "quilo" }].
 * Retorna [] quando há menos de 2 preços (o fluxo legado de preço único cuida).
 * A mensagem é dividida por conectores ("e", ",", "+"); cada parte contribui
 * com seu próprio item+preço.
 */
export function extractPricedItems(message: string): PricedItem[] {
  // O texto expandido (gírias de milhar) é a base dos índices — mesmo
  // pré-processamento do extractAllPriceOccurrences.
  const withMilhar = message.replace(
    /\b(\d{1,3}(?:\.\d{3})*|\d+)\s*(?:bar(?:ão|ao|ões|oes)|conto?s?)\b/gi,
    (_m, n: string) => `${Number(n.replace(/\./g, "")) * 1000} reais`,
  );
  const occurrences = extractAllPriceOccurrences(message);
  if (occurrences.length < 2) return [];

  // Divide por conectores, sem quebrar decimais ("89,90").
  const parts: { text: string; start: number; end: number }[] = [];
  const splitter = /(?<!\d)\s*,\s*|\s+e\s+|\s*\+\s*/giu;
  let lastIndex = 0;
  for (const m of withMilhar.matchAll(splitter)) {
    if (m.index === undefined) continue;
    parts.push({ text: withMilhar.slice(lastIndex, m.index), start: lastIndex, end: m.index });
    lastIndex = m.index + m[0].length;
  }
  parts.push({ text: withMilhar.slice(lastIndex), start: lastIndex, end: withMilhar.length });

  const result: PricedItem[] = [];
  for (const occ of occurrences) {
    const part = parts.find((p) => occ.index >= p.start && occ.index < p.end);
    if (!part) continue;
    const item = cleanPricedItemSegment(part.text);
    if (item.length < 2) continue;
    // Uma parte, um preço: ignora duplicatas da mesma parte.
    if (result.some((r) => r.item === item)) continue;
    const unit = extractUnitFromSegment(part.text);
    result.push({ item, price: occ.price, ...(unit ? { unit } : {}) });
  }
  return result.length >= 2 ? result : [];
}

function extractBarePriceCandidate(message: string) {
  if ((FREE_OFFER.test(message) && !NEGATED_FREE_OFFER.test(message)) || !BARE_PRICE.test(message))
    return undefined;
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

const MESES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

type SaoPauloDate = { year: number; month: number; day: number; weekday: number };

/** Data atual em America/Sao_Paulo (weekday: 0=domingo..6=sábado). `now` injetável para testes. */
function saoPauloToday(now: Date = new Date()): SaoPauloDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

function addDays(date: SaoPauloDate, days: number): SaoPauloDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/**
 * Resolve expressões relativas de data para datas concretas, usando a data
 * atual (America/Sao_Paulo) como referência. Retorna a validade por extenso,
 * pronta para o banner.
 * - "válido pra essa semana" → "12 a 18 de outubro de 2026"
 * - "para esse mês" → "outubro de 2026"
 * - "do dia 11 ao dia 15" → "11 a 15 de outubro de 2026"
 * - "10/10" → "10 de outubro de 2027" (próxima ocorrência; se já passou, ano seguinte)
 */
export function resolveRelativeDateValidity(
  message: string,
  now: Date = new Date(),
): string | undefined {
  const today = saoPauloToday(now);

  // "10/10", "11/11", "12/12" — dia/mês. Usa a próxima ocorrência (hoje ou
  // futuro); se a data já passou este ano, cai no ano seguinte.
  const slash = message.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slash?.[1] && slash?.[2]) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      let year = today.year;
      if (m < today.month || (m === today.month && d < today.day)) year += 1;
      return `${d} de ${MESES_PT[m - 1]} de ${year}`;
    }
  }

  // "do dia 11 ao dia 15" — infere mês e ano atuais.
  const range = message.match(/\bdo\s+dia\s+(\d{1,2})\s+ao\s+dia\s+(\d{1,2})\b/i);
  if (range?.[1] && range?.[2]) {
    return `${Number(range[1])} a ${Number(range[2])} de ${MESES_PT[today.month - 1]} de ${today.year}`;
  }

  // "válida pra essa semana" — segunda a domingo da semana atual.
  if (/\b(?:ess[ae]|nest[ae])\s+semana\b/i.test(message)) {
    const mondayOffset = (today.weekday + 6) % 7;
    const monday = addDays(today, -mondayOffset);
    const sunday = addDays(monday, 6);
    if (monday.month === sunday.month && monday.year === sunday.year) {
      return `${monday.day} a ${sunday.day} de ${MESES_PT[monday.month - 1]} de ${monday.year}`;
    }
    return `${monday.day} de ${MESES_PT[monday.month - 1]} a ${sunday.day} de ${MESES_PT[sunday.month - 1]} de ${sunday.year}`;
  }

  // "para esse mês" — mês/ano atual.
  if (/\b(?:ess[ae]|nest[ae])\s+m[eê]s\b/i.test(message)) {
    return `${MESES_PT[today.month - 1]} de ${today.year}`;
  }

  return undefined;
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
      /\b(?:por\s+|o\s+)?(?:pessoa|por[çc][aã]o|unidade|item|casal|adulto|crian[çc]a|kg|quilo|kilo|quilograma)\b/iu,
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
  if (NEGATED_FREE_OFFER.test(message)) return undefined;
  // Redação explícita do banner ("grátis", "por conta da casa") vence outras
  // formas de dizer grátis ("cortesia" aparece antes no texto, mas não é a
  // cópia que vai para a arte).
  const explicit = message.match(/\b(?:gr[aá]tis|gratuit[oa]s?|por\s+conta\s+da\s+casa)\b/iu)?.[0];
  if (explicit) return explicit;
  return message.match(new RegExp(`\\b(?:${FREE_WORDING_SOURCE})\\b`, "iu"))?.[0];
}

/**
 * Extrai o objetivo da peça a partir da intenção declarada.
 * Ex: "atrair clientes pra padaria", "divulgar meu evento", "promover a queima de estoque".
 * Retorna undefined quando não há objetivo explícito (não é obrigatório).
 */
function extractObjectiveFact(message: string): string | undefined {
  const m = message.match(
    /\b(?:quero|preciso|gostaria\s+de)\s+(atrair|trazer|chamar|conquistar|divulgar|promover|anunciar|lotar|movimentar|vender|mostrar)\b([^,.!?;]{0,80})/iu,
  );
  if (m?.[1]) {
    const objetivo = `${m[1]}${m[2] ?? ""}`.trim().replace(/\s+/g, " ");
    if (objetivo.length >= 4) return objetivo;
  }
  return undefined;
}

/**
 * Textos que o cliente marca explicitamente para aparecer no banner.
 * Ex: 'escreve "SÓ HOJE" bem grande', 'tem que ter o telefone'.
 */
function extractMandatoryTexts(message: string): string[] {
  const out: string[] = [];
  for (const m of message.matchAll(
    /\b(?:escrev(?:a|er)|coloc(?:a|ar|que)|tem\s+que\s+ter|inclu[ai](?:r)?|aparecer)\b[^,.!?;]{0,10}["“]([^"”]{2,60})["”]/giu,
  )) {
    if (m[1]?.trim()) out.push(m[1].trim());
  }
  return out;
}

/**
 * BRIEFING formal: conjunto de informações que explica o que o banner precisa
 * comunicar e para quem. Montado a partir da conversa + cadastro da empresa.
 */
export type BannerBriefing = {
  /** O que será divulgado (itens). */
  oQueDivulgar: string[];
  /** Objetivo da peça, se declarado. */
  objetivo?: string | undefined;
  /** Preço/condição comercial, se houver. */
  preco?: string | undefined;
  /** Validade/período, se houver. */
  validade?: string | undefined;
  /** Textos que devem aparecer literalmente. */
  textosObrigatorios: string[];
  /** Identidade visual vinda do cadastro. */
  identidadeVisual: {
    cores: string[];
    temLogo: boolean;
    estilo?: string | undefined;
  };
  /** Nome oficial da empresa. */
  empresa: string;
  /** O que é essencial e ainda está faltando (para decidir se pergunta). */
  faltando: string[];
  /** true quando há informação suficiente para gerar sem perguntas. */
  pronto: boolean;
};

export type BannerCompanyIdentity = {
  nome?: string | null | undefined;
  cores?: string[] | undefined;
  temLogo?: boolean | undefined;
  estilo?: string | null | undefined;
};

/**
 * Monta o briefing formal. Regra: o que será divulgado é essencial;
 * preço/validade só entram se o cliente mencionou; objetivo e identidade
 * vêm do cadastro quando não declarados. Se faltar algo essencial,
 * `faltando` indica o que perguntar; se `pronto`, segue sem perguntas.
 */
export function montarBriefing(
  brief: BannerConversationBrief,
  identidade: BannerCompanyIdentity,
): BannerBriefing {
  const oQueDivulgar = brief.offerItems?.length
    ? brief.offerItems
    : extractOfferItems(brief.subject);
  const faltando: string[] = [];
  if (!oQueDivulgar.length && !brief.subject?.trim()) {
    faltando.push("o que será divulgado");
  }
  const preco = brief.pricedItems?.length
    ? brief.pricedItems
        .map((p) => `${p.item}: ${formatOfferPrice(p.price)}${p.unit ? ` (${p.unit})` : ""}`)
        .join(" · ")
    : brief.price !== undefined
      ? formatOfferPrice(brief.price)
      : (brief.commercialCondition ?? undefined);
  const validade =
    brief.validity ??
    (brief.weekdays?.length
      ? brief.recurrence === "WEEKLY"
        ? `toda ${brief.weekdays.join(" e ")}`
        : brief.weekdays.join(" e ")
      : brief.weekday
        ? brief.recurrence === "WEEKLY"
          ? `toda ${brief.weekday}`
          : brief.weekday
        : undefined);
  return {
    oQueDivulgar,
    ...(brief.objective ? { objetivo: brief.objective } : {}),
    ...(preco ? { preco } : {}),
    ...(validade ? { validade } : {}),
    textosObrigatorios: brief.mandatoryTexts ?? [],
    identidadeVisual: {
      cores: identidade.cores ?? [],
      temLogo: identidade.temLogo ?? false,
      ...(identidade.estilo ? { estilo: identidade.estilo } : {}),
    },
    empresa: identidade.nome ?? "empresa",
    faltando,
    pronto: faltando.length === 0,
  };
}

/** Formata o briefing para injeção no system prompt, em linguagem simples. */
export function formatarBriefing(briefing: BannerBriefing): string {
  const linhas = [
    "BRIEFING OFICIAL (base para os 2 prompts):",
    `- O que divulgar: ${briefing.oQueDivulgar.join(" + ") || "(a definir)"}`,
  ];
  if (briefing.objetivo) linhas.push(`- Objetivo: ${briefing.objetivo}`);
  if (briefing.preco) linhas.push(`- Preço/condição: ${briefing.preco}`);
  if (briefing.validade) linhas.push(`- Validade: ${briefing.validade}`);
  if (briefing.textosObrigatorios.length)
    linhas.push(
      `- Textos obrigatórios: ${briefing.textosObrigatorios.map((t) => `"${t}"`).join(", ")}`,
    );
  const id = briefing.identidadeVisual;
  const idParts = [
    id.cores.length ? `cores ${id.cores.join(", ")}` : null,
    id.temLogo ? "logo oficial" : null,
    id.estilo ? `estilo ${id.estilo}` : null,
  ].filter(Boolean);
  if (idParts.length) linhas.push(`- Identidade visual: ${idParts.join("; ")}`);
  linhas.push(`- Empresa: ${briefing.empresa}`);
  return linhas.join("\n");
}

function extractCommercialSubject(message: string) {
  if (/^\s*(?:o\s+)?(?:pre[cç]o|valor)\b/iu.test(message)) return undefined;

  // A common promotion structure combines a purchased item with a courtesy
  // item. Keep only those products in the structured subject; the full user
  // message remains available to the model for the exact condition/copy.
  const purchaseItem = message
    .match(/\bna\s+compra\s+(?:de\s+)?(?:qualquer\s+)?([^,.!?;]+?)(?=[,.!?;]|$)/iu)?.[1]
    ?.replace(/^\s*(?:qualquer|um(?:a)?|o|a|os|as)\s+/iu, "")
    .trim();
  const courtesyItem = message
    .match(
      /\b(?:oferece|oferecer|ganhe|ganhar|ganha|receba|receber|recebe|leva|leve|d[aá]|d[eê])\s+(?:um|uma|o|a)\s+([^,.!?;]+?)\s+(?:de\s+)?(?:cortesia|gr[aá]tis|gratuit[oa]s?|sem\s+custo)\b/iu,
    )?.[1]
    ?.replace(/^\s*(?:qualquer|um(?:a)?|o|a|os|as)\s+/iu, "")
    .trim();
  if (purchaseItem && courtesyItem) return `${purchaseItem} e ${courtesyItem}`;

  const messageCore = message
    .replace(/^\s*teste(?:\s+(?:interno|local))?\s*[:—-]\s*/iu, "")
    .replace(
      /^\s*(?:(?:quero|preciso|gostaria\s+de)\s+)?criar\s+(?:duas?\s+)?(?:ideias?|op[cç][õo]es?)\s+(?:de\s+)?(?:um\s+)?(?:banner|arte|imagem)\s+(?:bem\s+)?diferentes?\s+para\s+[^:,.!?]+:\s*/iu,
      "",
    )
    .replace(
      /^\s*(?:crie?|criar)\s+(?:duas?\s+)?(?:ideias?|op[cç][õo]es?)\s+para\s+divulgar\s+que\s*/iu,
      "",
    )
    .replace(
      /[.!?]\s*(?:deixe\s+claro|n[aã]o\s+invente|sem\s+inventar|quero\s+duas?|fa[cç]a\s+duas?)[\s\S]*$/iu,
      "",
    );
  if (
    /^\s*(?:(?:como\s+)?(?:criar|fazer|montar)\s+)?(?:um(?:a)?\s+)?(?:banner|arte|imagem)\s*(?:de\s+)?(?:uma?\s+)?(?:promo(?:ç|c)[aã]o|oferta)(?:\s+da\s+semana)?\s*$/iu.test(
      message,
    )
  )
    return undefined;
  const normalized = messageCore
    .replace(/[.!?]+\s*$/u, "")
    .replace(/\s+/gu, " ")
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
    .replace(
      /\b\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*(?:reais?|pila|money|bar(?:ão|ao|ões|oes)|conto?s?)\b/giu,
      "",
    )
    // "Avaliação gratuita" is the commercial subject itself and should stay
    // readable; standalone free-price expressions are conditions, not items.
    .replace(/\b(?:gr[aá]tis|sem\s+custo|por\s+conta\s+da\s+casa)\b/giu, "")
    .replace(
      /(?:,|\s)+(?:na\s+|no\s+|nesta\s+|neste\s+|nessa\s+|nesse\s+|desta\s+|deste\s+|dessa\s+|desse\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?(?:\s+por\s+(?:pessoa|por[çc][aã]o|unidade|item))?\s*$/iu,
      "",
    )
    .replace(
      /(?:,|\s)+(?:v[áa]lid[ao]\s+)?(?:at[ée]\s+\S+|somente\s+\S+|(?:(?:n[ao]|nessa|dessa|esta|essa|neste|nesse|deste|desse|nesta|desta)\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?|(?:(?:neste|nesse|deste|desse|esse)\s+)?fim\s+de\s+semana|durante\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))(?:\s+(?:[àa]s|as)\s*\d{1,2}(?::\d{2}|h(?:\d{2})?)?)?\s*$/iu,
      "",
    )
    .replace(
      /^\s*(?:v[áa]lid[ao]\s+)?(?:at[ée]\s+\S+|somente\s+\S+|(?:(?:n[ao]|nessa|dessa|esta|essa|neste|nesse|deste|desse|nesta|desta)\s+)?(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:[-\s]?feira)?|(?:(?:neste|nesse|deste|desse|esse)\s+)?fim\s+de\s+semana|durante\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))\s*$/iu,
      "",
    )
    .replace(/\bpor\s*$/iu, "")
    // Resposta "tudo junto" (dia + preço + validade) não é assunto: tira as
    // cláusulas de fato para não virar item obrigatório impossível de cumprir.
    .replace(
      /^\s*(?:toda|todo|todas|todos)?\s*(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(?:-feira|\s+feira)?\s*,\s*/iu,
      "",
    )
    .replace(/,?\s*valor\s+(?:de\s+)?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\b/giu, "")
    .replace(
      /,?\s*v[áa]lid[oa]s?\s+para\s+(?:o\s+m[êe]s\s+de\s+)?(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/giu,
      "",
    )
    .replace(/^\s*,\s*/u, "")
    // Resíduo só de recorrência ("toda" de "toda quarta feira", "tota" do
    // typo) não é produto: mensagem que só responde dia/recorrência nunca
    // pode virar assunto e expulsar o assunto anterior.
    .replace(/^\s*(?:toda|todo|todas|todos|tota)\b\s*/iu, "")
    .replace(/\s+(?:toda|todo|todas|todos|tota)\b\s*$/iu, "")
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
  // Pedido multi-preço: cada item carrega seu próprio preço (um pode ser
  // grátis enquanto outro tem preço). O preço único legado é ignorado aqui.
  const pricedItems = extractPricedItems(message);
  if (pricedItems.length >= 2) {
    facts.pricedItems = pricedItems;
  } else {
    const price = extractPriceFact(message);
    if (price !== undefined) facts.price = price;
    const priceUnit = extractPriceUnit(message);
    if (priceUnit) facts.priceUnit = priceUnit;
  }
  const barePrice = extractBarePriceCandidate(message);
  if (barePrice !== undefined) facts.priceCandidate = barePrice;
  const commercialCondition = extractCommercialCondition(message);
  if (commercialCondition) facts.commercialCondition = commercialCondition;
  if (FREE_OFFER.test(message) && !NEGATED_FREE_OFFER.test(message)) facts.freeCopyConfirmed = true;
  const objective = extractObjectiveFact(message);
  if (objective) facts.objective = objective;
  const mandatoryTexts = extractMandatoryTexts(message);
  if (mandatoryTexts.length) {
    const prev = context as BannerConversationBrief | undefined;
    const merged = [...(prev?.mandatoryTexts ?? []), ...mandatoryTexts].filter(
      (t, i, arr) => arr.indexOf(t) === i,
    );
    facts.mandatoryTexts = merged;
  }
  // Expressões relativas ("essa semana", "10/10") viram datas concretas antes
  // de qualquer outra interpretação de validade.
  const validity = resolveRelativeDateValidity(message) ?? extractValidityFact(message);
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
  if (
    /^\s*(?:combo|oferta\s+completa|completa|completo|combo\s+completo)\s*[.!]?\s*$/iu.test(
      message,
    ) ||
    /^\s*(?:sim|isso|correto|exato|confirmo|pode\s+ser)\b.*\b(?:combo|oferta completa|completa|completo)\b/iu.test(
      message,
    )
  ) {
    facts.scopeConfirmed = true;
  }
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
      !/^\s*(?:combo|completa|completo|combo\s+completo)\s*[.!]?\s*$/iu.test(message) &&
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
    ...(facts.objective !== undefined ? { objective: facts.objective } : {}),
    ...(facts.mandatoryTexts !== undefined ? { mandatoryTexts: facts.mandatoryTexts } : {}),
    ...(facts.price !== undefined ? { price: facts.price } : {}),
    ...(facts.price !== undefined ? { priceCandidate: undefined } : {}),
    ...(facts.priceUnit !== undefined ? { priceUnit: facts.priceUnit } : {}),
    ...(facts.priceCandidate !== undefined ? { priceCandidate: facts.priceCandidate } : {}),
    // Preços por item substituem o preço único (e vice-versa): as duas
    // representações nunca coexistem para não gerar validação ambígua.
    ...(facts.pricedItems !== undefined
      ? {
          pricedItems: facts.pricedItems,
          price: undefined,
          priceUnit: undefined,
          priceCandidate: undefined,
        }
      : {}),
    ...(facts.price !== undefined && facts.pricedItems === undefined
      ? { pricedItems: undefined }
      : {}),
    ...(facts.commercialCondition !== undefined
      ? { commercialCondition: facts.commercialCondition }
      : {}),
    ...(facts.freeCopyConfirmed !== undefined
      ? { freeCopyConfirmed: facts.freeCopyConfirmed }
      : {}),
    ...(facts.validity !== undefined ? { validity: facts.validity } : {}),
    ...(facts.weekday !== undefined ? { weekday: facts.weekday } : {}),
    ...(facts.weekdays !== undefined ? { weekdays: facts.weekdays } : {}),
    ...(facts.dateContext !== undefined ? { dateContext: facts.dateContext } : {}),
    ...(facts.recurrence !== undefined ? { recurrence: facts.recurrence } : {}),
    ...(facts.unit !== undefined ? { unit: facts.unit } : {}),
    ...(facts.time !== undefined ? { time: facts.time } : {}),
    ...(facts.scopeConfirmed !== undefined ? { scopeConfirmed: facts.scopeConfirmed } : {}),
    ...(facts.scopeConfirmed === true ? { pendingQuestion: undefined } : {}),
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
  // “Combo” is a direct answer to the offer-scope question. Accept it even
  // when an older client persisted the previous price-confirmation marker.
  if (/^\s*(?:combo|completa|completo|combo\s+completo)\s*[.!]?\s*$/iu.test(message)) {
    return {
      ...brief,
      ...(brief.price === undefined && brief.priceCandidate !== undefined
        ? { price: brief.priceCandidate, priceCandidate: undefined }
        : {}),
      scopeConfirmed: true,
      pendingQuestion: undefined,
    };
  }
  if (brief.pendingQuestion === "price_confirmation") {
    const candidate = extractBarePriceCandidate(message);
    if (candidate !== undefined)
      return candidate === brief.priceCandidate
        ? {
            ...brief,
            price: candidate,
            priceCandidate: undefined,
            pendingQuestion: undefined,
          }
        : { ...brief, priceCandidate: candidate, pendingQuestion: "price_confirmation" };
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
  if (brief.pendingQuestion === "date_confirmation") {
    // Dias/datas são extraídos automaticamente pelo extractBannerTurnFacts.
    // Marca como perguntado para não repetir; a resposta (ou a ausência dela)
    // encerra a pergunta pendente.
    return { ...brief, dateAsked: true, pendingQuestion: undefined };
  }
  if (brief.pendingQuestion === "business_compatibility_confirmation") {
    if (confirmationIntent(message) === "positive")
      return { ...brief, compatibilityConfirmed: true, pendingQuestion: undefined };
    if (confirmationIntent(message) === "negative")
      return {
        pendingQuestion: "subject",
        compatibilityConfirmed: false,
      };
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
    let resolved = resolvePendingBannerQuestion(previous, latestMessage);
    // If the client carried an older brief without the price, recover it from
    // the conversation history before resolving a direct scope answer such
    // as “Combo”. This prevents the price question from being reopened.
    if (
      /\b(?:combo|oferta\s+completa|completa|completo)\b/iu.test(latestMessage) &&
      /^(?:\s*(?:sim|isso|correto|exato|confirmo|pode\s+ser)\b)?[\s,]*(?:ao|a|o|do|da)?[\s,]*(?:combo|oferta|oferta\s+completa|completa|completo)\b/iu.test(
        latestMessage,
      ) &&
      resolved.price === undefined &&
      resolved.priceCandidate === undefined
    ) {
      for (const priorMessage of messages.slice(0, -1).reverse()) {
        const priorFacts = extractBannerTurnFacts(priorMessage, resolved);
        if (priorFacts.price !== undefined || priorFacts.priceCandidate !== undefined) {
          resolved = mergeBannerConversationBrief(resolved, priorFacts);
          break;
        }
      }
    }
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
    hasPrice: brief.price !== undefined || (brief.pricedItems?.length ?? 0) > 0,
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
      ? `Só pra eu acertar: essa condição de ${activeBrief.commercialCondition ?? formatOfferPrice(activeBrief.price)} vale só para qual item?`
      : "Só pra eu acertar: essa condição vale só para qual item?";
  }
  if (activeBrief.commercialCondition && !activeBrief.freeCopyConfirmed) {
    return "Como você prefere escrever essa cortesia no banner: “Grátis” ou “Por conta da casa”?";
  }
  const state = commercialStateFromBrief(activeBrief, messages);
  const comboAlreadyNamed =
    /\bcombo\b/iu.test(activeBrief.subject ?? "") || /\bcombo\b/iu.test(conversation);
  if (comboAlreadyNamed && (state.hasPrice || activeBrief.priceCandidate !== undefined)) {
    return null;
  }
  const temporal =
    TEMPORAL_COMMERCIAL_REQUEST.test(conversation) ||
    Boolean(activeBrief.commercialCondition || activeBrief.freeCopyConfirmed) ||
    /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial)\b/iu.test(activeBrief.subject ?? "");
  if (!state.hasSubject)
    return "O que você gostaria de divulgar? Pode ser um produto, serviço ou uma condição especial.";
  if (activeBrief.priceCandidate !== undefined)
    return `Só confirmando: você quer destacar ${formatBRL(activeBrief.priceCandidate)} como o valor da oferta?`;
  if (!state.hasPrice && EXPLICIT_PRICE_INTENT.test(conversation))
    return "Qual valor exato você quer destacar nessa promoção?";
  // Pergunta proativa de data/dia: oferta comercial sem nenhuma informação de
  // data (validade, dia da semana). Não repete se já perguntou; ofertas
  // temporais usam a pergunta de validade abaixo.
  const hasDateInfo = Boolean(
    activeBrief.validity || activeBrief.weekday || (activeBrief.weekdays?.length ?? 0) > 0,
  );
  if (
    !temporal &&
    !hasDateInfo &&
    !activeBrief.dateAsked &&
    (state.hasPrice || Boolean(activeBrief.commercialCondition || activeBrief.freeCopyConfirmed))
  ) {
    return "Essa promoção é para uma data especial? Um dia da semana? 📅";
  }
  if (temporal && !state.hasValidity) {
    const isFestival = /\bfestival\b/iu.test(activeBrief.subject ?? "");
    if (/promo(?:ç|c)[aã]o\s+(?:da|de|para)\s+semana/iu.test(conversation)) {
      const today = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
      return `Hoje é ${today}. Você quer considerar a semana desde segunda-feira, começar na próxima semana ou deixar essa promoção válida independentemente do dia?`;
    }
    return isFestival
      ? "Esse festival acontece em um dia específico, durante a semana toda ou em outro período?"
      : "E essa promoção vale até quando ou em quais dias?";
  }
  if (
    state.hasPrice &&
    !state.hasConfirmedScope &&
    !state.isSingleService &&
    !activeBrief.priceUnit &&
    !comboAlreadyNamed
  ) {
    const items = activeBrief.offerItems?.length
      ? activeBrief.offerItems
      : extractOfferItems(activeBrief.subject);
    const price =
      activeBrief.price !== undefined
        ? (activeBrief.commercialCondition ?? formatOfferPrice(activeBrief.price))
        : "Esse valor";
    if (items.length === 2)
      return `${price} é pelos dois itens juntos — ${items[0]} e ${items[1]} — ou cada um tem esse valor?`;
    return `${price} vale para a oferta toda ou para cada item?`;
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
  if (brief.commercialCondition && !brief.freeCopyConfirmed) return undefined;
  const state = commercialStateFromBrief(brief, messages);
  const comboAlreadyNamed =
    /\bcombo\b/iu.test(brief.subject ?? "") || /\bcombo\b/iu.test(conversation);
  if (comboAlreadyNamed && (state.hasPrice || brief.priceCandidate !== undefined)) return undefined;
  const temporal =
    TEMPORAL_COMMERCIAL_REQUEST.test(conversation) ||
    Boolean(brief.commercialCondition || brief.freeCopyConfirmed) ||
    /\b(?:festival|feira|evento|edi[çc][aã]o\s+especial)\b/iu.test(brief.subject ?? "");
  if (!state.hasSubject) return "subject" as const;
  if (temporal && !state.hasValidity) return undefined;
  if (
    brief.priceCandidate !== undefined ||
    (!state.hasPrice && EXPLICIT_PRICE_INTENT.test(conversation))
  )
    return "price_confirmation" as const;
  // Espelha a pergunta proativa de data/dia do nextCommercialQuestion.
  const hasDateInfo = Boolean(brief.validity || brief.weekday || (brief.weekdays?.length ?? 0) > 0);
  if (
    !temporal &&
    !hasDateInfo &&
    !brief.dateAsked &&
    (state.hasPrice || Boolean(brief.commercialCondition || brief.freeCopyConfirmed))
  )
    return "date_confirmation" as const;
  if (
    state.hasPrice &&
    !state.hasConfirmedScope &&
    !state.isSingleService &&
    !brief.priceUnit &&
    !comboAlreadyNamed
  )
    return "offer_scope_confirmation" as const;
  return undefined;
}

export type RequiredOfferFacts = {
  items: string[];
  price?: number;
  /** Preços por item. Quando presente, substitui o `price` único na validação. */
  pricedItems?: PricedItem[];
  /** Exact benefit wording chosen by the user; zero price never rewrites it. */
  commercialCopy?: string;
  priceUnit?: string;
  validity?: string;
  weekday?: string;
  /** Todos os dias citados; `weekday` segue como o primeiro por compatibilidade. */
  weekdays?: string[];
  /** Horário confirmado no formato HH:MM (ex.: "21:00"). */
  time?: string;
  /** Assunto do pedido, para exigir a palavra do evento nos textos. */
  subject?: string;
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
    | "MISSING_COMMERCIAL_COPY"
    | "MISSING_VALIDITY"
    | "MISSING_UNIT"
    | "INVENTED_RECURRENCE"
    | "WRONG_TIME"
    | "MISSING_TIME"
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
        /** Preços por item; quando o pedido tem múltiplos preços, é obrigatório. */
        pricedItems?: readonly PricedItem[] | undefined;
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
  const items = brief.offerItems?.length ? brief.offerItems : extractOfferItems(brief.subject);
  return {
    items,
    ...(brief.price !== undefined ? { price: brief.price } : {}),
    // Preços por item só entram quando o briefing tem múltiplos preços; o
    // preço único legado continua no campo `price`.
    ...(brief.pricedItems?.length ? { pricedItems: brief.pricedItems } : {}),
    ...(brief.commercialCondition ? { commercialCopy: brief.commercialCondition } : {}),
    ...(brief.priceUnit ? { priceUnit: brief.priceUnit } : {}),
    ...(brief.validity ? { validity: brief.validity } : {}),
    ...(brief.weekday ? { weekday: brief.weekday } : {}),
    ...(brief.weekdays?.length ? { weekdays: brief.weekdays } : {}),
    ...(brief.time ? { time: brief.time } : {}),
    ...(brief.subject ? { subject: brief.subject } : {}),
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

function normalizedCommercialUnit(value: string) {
  const normalized = normalizedWords(value);
  if (/\b(?:kg|quilo|kilo|quilograma)\b/.test(normalized)) return "quilo";
  if (/\b(?:unidade|unitario|cada)\b/.test(normalized)) return "unidade";
  if (/\b(?:porcao|pessoa|item)\b/.test(normalized)) return "porcao";
  return normalized;
}

/**
 * Final commercial gate. `visualItems` makes the product representation
 * inspectable separately from the artwork copy, so writing “+ café” in text
 * cannot hide the fact that the coffee was omitted from the composition.
 */
/**
 * Fragmentos que o modelo enfia na lista de itens quando o pedido mistura
 * evento + dia recorrente + validade + preço (visto em produção: "R$ 19,90",
 * "válido para", "toda quarta-feira"). Preço, validade e dia não são itens
 * comerciais — removê-los antes de validar evita rejeitar uma boa ideia por
 * metadado sujo, sem inventar nem apagar item real.
 */
export function sanitizeGeneratedItems(items: readonly string[] | undefined): string[] | undefined {
  if (!items) return items;
  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      if (/r\$/iu.test(item)) return false;
      if (/^\s*(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*$/.test(item)) return false;
      if (/^\s*v[aá]lid[oa]?\b/iu.test(item)) return false;
      // O dia da semana NÃO é apagado: quando ele vem do assunto, o validador
      // o exige como item obrigatório — apagar aqui criava MISSING_OFFER_ITEM.
      return true;
    });
}

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
  // Validação por item: cada item+preço confirmado precisa aparecer com o
  // valor exato, e nenhum preço não confirmado pode aparecer. O preço único
  // legado é tratado como um item precificado para compatibilidade.
  const requiredHasPriced = (required.pricedItems?.length ?? 0) > 0;
  const generatedHasPriced = (facts.pricedItems?.length ?? 0) > 0;
  if (!requiredHasPriced && !generatedHasPriced) {
    if (required.price !== undefined && facts.price !== required.price) {
      violations.push({
        reason: "WRONG_PRICE",
        detail: `Preço deve ser ${formatOfferPrice(required.price)}`,
      });
    }
  } else {
    const requiredPriced: readonly PricedItem[] =
      required.pricedItems ??
      (required.price !== undefined
        ? [{ item: required.items[0] ?? "", price: required.price }]
        : []);
    const generatedPriced: readonly PricedItem[] =
      facts.pricedItems ??
      (facts.price !== undefined ? [{ item: facts.items[0] ?? "", price: facts.price }] : []);
    for (const req of requiredPriced) {
      const match = generatedPriced.find(
        (gen) => gen.price === req.price && sameCommercialItem(gen.item, req.item),
      );
      if (!match) {
        violations.push({
          reason: "WRONG_PRICE",
          detail: `Preço de "${req.item}" deve ser ${formatOfferPrice(req.price)}`,
        });
      }
    }
    for (const gen of generatedPriced) {
      if (!requiredPriced.some((req) => sameCommercialItem(req.item, gen.item))) {
        violations.push({
          reason: "WRONG_PRICE",
          detail: `Preço não confirmado para "${gen.item}"`,
        });
      }
    }
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
  if (
    required.unit &&
    normalizedCommercialUnit(facts.unit ?? "") !== normalizedCommercialUnit(required.unit)
  ) {
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

/** Ensure the actual image prompt includes the benefit wording the user chose. */
export function validatePromptCommercialCopy(prompt: string, required: RequiredOfferFacts) {
  if (!required.commercialCopy) return [];
  const promptWords = normalizedWords(prompt);
  const copyWords = normalizedWords(required.commercialCopy);
  if (!copyWords || promptWords.includes(copyWords)) return [];
  return [
    {
      reason: "MISSING_COMMERCIAL_COPY" as const,
      detail: `O prompt precisa manter a expressão comercial informada: ${required.commercialCopy}`,
    },
  ];
}

export type TextQualityViolation = {
  reason: "TEXT_TOO_LONG" | "TOO_MANY_TEXTS" | "VAGUE_TEXT_INSTRUCTION";
  detail: string;
};

/**
 * IAs de imagem distorcem texto com frequência. Textos no banner precisam ser
 * curtos, exatos (entre aspas) e poucos: título, oferta e CTA. Textos longos
 * ou vagos ("texto sobre a promoção") quase sempre saem com letras
 * bagunçadas — o validador prefere encurtar.
 */
export type OfferTextViolation = {
  reason: "MISSING_OFFER_TEXT";
  detail: string;
};

/**
 * O banner precisa VENDER a oferta: o nome do produto e o preço confirmado
 * têm que aparecer nos textos entre aspas (o que o cliente lê). Metadados
 * certos com texto errado (ex.: cuca virando pão, preço sumindo) passam nos
 * outros validadores — este fecha esse buraco.
 */
export function validatePromptOfferTexts(
  prompt: string,
  required: RequiredOfferFacts,
): OfferTextViolation[] {
  const violations: OfferTextViolation[] = [];
  const quoted = [...prompt.matchAll(/["“]([^"”]{1,200})["”]/g)]
    .map((m) => m[1]?.trim())
    .filter((t): t is string => Boolean(t && t.length > 0))
    .join(" ");
  // Palavras que nunca anunciam um produto sozinhas. Um item feito só delas
  // ("toda") é brief quebrado, não oferta — reprovar aqui impede que ele
  // passe por substring do dia ("TODA QUARTA-FEIRA").
  const functionWords = new Set([
    "toda", "todo", "todas", "todos", "tota",
    "para", "pela", "pelo", "com", "sem", "sobre", "entre", "cada",
    "nesta", "neste", "nessa", "nesse", "das", "dos", "uma", "uns", "umas",
    "aos", "ao", "os", "as", "de", "da", "do", "em", "na", "no", "que", "e",
    "um", "a", "o", "por", "seu", "sua", "seus", "suas", "meu", "minha",
    "nos", "nas", "nosso", "nossa",
  ]);
  const mainItem = required.items?.[0];
  if (mainItem) {
    const words = normalizedWords(mainItem)
      .split(/\s+/u)
      .filter((word) => word.length > 3);
    const hay = normalizedWords(quoted);
    if (words.length > 0 && words.every((word) => functionWords.has(word))) {
      violations.push({
        reason: "MISSING_OFFER_TEXT",
        detail: `O item obrigatório "${mainItem}" não tem palavra anunciável para o texto do banner — o assunto do pedido foi perdido; inclua o produto ou evento real nos textos entre aspas.`,
      });
    } else if (words.length > 0 && !words.some((word) => hay.includes(word))) {
      violations.push({
        reason: "MISSING_OFFER_TEXT",
        detail: `O texto do banner precisa anunciar a oferta "${mainItem}" — inclua uma dessas palavras nos textos entre aspas: ${words.join(", ")}.`,
      });
    }
  }
  if (required.subject) {
    const ignored = new Set([
      "segunda", "terca", "terça", "quarta", "quinta", "sexta", "sabado", "sábado",
      "domingo", "feira",
      "janeiro", "fevereiro", "marco", "março", "abril", "maio", "junho", "julho",
      "agosto", "setembro", "outubro", "novembro", "dezembro",
      "igreja", "loja", "padaria", "restaurante", "mercado", "salao", "salão",
      "clinica", "clínica", "academia", "escola", "bar", "cafe", "café",
      "lanchonete", "pizzaria", "farmacia", "farmácia", "oficina", "empresa",
      "comercio", "comércio",
      "para", "pela", "pelo", "com", "sem", "sobre", "entre", "toda", "todo",
      "todas", "todos", "cada", "nesta", "neste", "nessa", "nesse", "das", "dos",
      "uma", "uns", "umas", "aos", "ao", "os", "as", "de", "da", "do", "em", "na",
      "no", "que", "e", "um", "a", "o", "por", "seu", "sua", "seus", "suas",
      "meu", "minha", "nos", "nas", "nosso", "nossa", "dia", "horario", "horário",
    ]);
    const core = [
      ...new Set(
        normalizedWords(required.subject)
          .split(/\s+/u)
          .filter((word) => word.length > 3 && !/\d/.test(word) && !ignored.has(word)),
      ),
    ];
    const hay = normalizedWords(quoted);
    if (core.length > 0 && !core.some((word) => hay.includes(word))) {
      violations.push({
        reason: "MISSING_OFFER_TEXT",
        detail: `O texto do banner precisa anunciar o assunto "${required.subject}" — inclua uma dessas palavras nos textos entre aspas: ${core.join(", ")}.`,
      });
    }
  }
  if (required.price !== undefined && required.price > 0) {
    const br = required.price.toFixed(2).replace(".", ",");
    const us = required.price.toFixed(2);
    if (!quoted.includes(br) && !quoted.includes(us)) {
      violations.push({
        reason: "MISSING_OFFER_TEXT",
        detail: `O texto do banner precisa mostrar o preço R$ ${br} entre aspas.`,
      });
    }
  }
  return violations;
}

export function validatePromptTextQuality(prompt: string): TextQualityViolation[] {
  const violations: TextQualityViolation[] = [];
  const quoted = [...prompt.matchAll(/["“]([^"”]{1,200})["”]/g)]
    .map((m) => m[1]?.trim())
    .filter((t): t is string => Boolean(t && t.length > 0));

  for (const text of quoted) {
    if (text.length > 40) {
      violations.push({
        reason: "TEXT_TOO_LONG",
        detail: `Texto longo demais para renderização ("${text.slice(0, 32)}…", ${text.length} caracteres): encurte para no máximo 40 caracteres, mantendo o sentido.`,
      });
    }
  }

  if (quoted.length > 4) {
    violations.push({
      reason: "TOO_MANY_TEXTS",
      detail: `Textos demais no banner (${quoted.length}): reduza para no máximo 4, priorizando título, oferta e CTA.`,
    });
  }

  // Instrução vaga de texto sem o texto exato entre aspas.
  if (
    quoted.length === 0 &&
    /\b(?:incluir|adicionar|colocar|escrever)\s+(?:um\s+)?texto\b/iu.test(prompt) &&
    !/\btexto\s+["“]/iu.test(prompt)
  ) {
    violations.push({
      reason: "VAGUE_TEXT_INSTRUCTION",
      detail:
        "Instrução de texto vaga sem o texto exato entre aspas: especifique o texto literal a renderizar.",
    });
  }

  return violations;
}

/** Reject weekly wording unless the user explicitly established a recurrence.
 *  All listed weekdays must be mentioned correctly in the prompt. */
export function validatePromptTemporalFacts(
  prompt: string,
  required: RequiredOfferFacts,
): CommercialFactViolation[] {
  const violations: CommercialFactViolation[] = [];
  const weekdays: string[] =
    required.weekdays && required.weekdays.length > 0
      ? required.weekdays
      : required.weekday
        ? [required.weekday]
        : [];
  const normalized = normalizedWords(prompt);
  // O horário é fato confirmado como o dia: 21h virando 20h nos textos é
  // rejeição, não detalhe. Só viola quando nenhum horário citado bate com o
  // confirmado, para não punir faixas ("das 8h às 18h").
  if (required.time) {
    const [reqHour, reqMinute] = required.time.split(":").map(Number);
    const requiredTime = `${String(reqHour).padStart(2, "0")}:${String(reqMinute).padStart(2, "0")}`;
    const displayTime =
      reqMinute === 0 ? `${reqHour}h` : `${reqHour}h${String(reqMinute).padStart(2, "0")}`;
    const quoted = [...prompt.matchAll(/["“]([^"”]{1,200})["”]/g)].map((m) => m[1] ?? "");
    const quotedTimes: string[] = [];
    for (const text of quoted) {
      for (const m of text.matchAll(/\b(\d{1,2})\s*(?:h(?:\s*(\d{2}))?|:(\d{2}))(?!\d)/giu)) {
        const hour = Number(m[1]);
        const minute = Number(m[2] ?? m[3] ?? 0);
        if (hour <= 23 && minute <= 59) {
          quotedTimes.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
        }
      }
    }
    if (quotedTimes.length === 0) {
      violations.push({
        reason: "MISSING_TIME",
        detail: `Horário obrigatório ausente nos textos entre aspas: ${displayTime}.`,
      });
    } else if (!quotedTimes.includes(requiredTime)) {
      violations.push({
        reason: "WRONG_TIME",
        detail: `Horário trocado nos textos entre aspas (${quotedTimes.join(", ")}); o horário confirmado é ${displayTime}.`,
      });
    }
  }
  for (const weekday of weekdays) {
    const weekdayPattern = normalizedWords(weekday).replace(" feira", "(?: feira)?");
    // Recorrência inventada: só vale se o usuário informou WEEKLY.
    if (
      required.recurrence !== "WEEKLY" &&
      new RegExp(
        `\\b(?:toda|todo|todos|todas|semanal|semanalmente)\\s+${weekdayPattern}\\b`,
        "iu",
      ).test(normalized)
    ) {
      violations.push({
        reason: "INVENTED_RECURRENCE",
        detail: `Recorrência não foi informada; preserve somente ${weekday}`,
      });
    }
    // O dia precisa aparecer no prompt (por extenso ou abreviado).
    const base = normalizedWords(weekday).replace(/-feira| feira/g, "");
    if (!new RegExp(`\\b${base}(?:-feira| feira)?s?\\b`, "iu").test(normalized)) {
      violations.push({
        reason: "MISSING_VALIDITY",
        detail: `Dia obrigatório ausente no prompt: ${weekday}`,
      });
    }
  }
  return violations;
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

/** Reject near-copy pairs while ignoring shared brand and offer vocabulary. */
export function validatePromptConceptSeparation(first: string, second: string) {
  const photoLed = (value: string) =>
    /\b(?:protagonismo\s+da\s+oferta|fotografia\s+(?:publicit[aá]ria|editorial|realista)(?:\s+realista)?\s+(?:(?:de|do)\s+)?produto|foto(?:grafia)?\s+de\s+produto\s+(?:como\s+)?(?:foco|protagonista)|still\s+life\s+fotogr[aá]fico|imagem\s+fotogr[aá]fica\s+(?:do\s+)?produto)\b/iu.test(
      value,
    );
  const experienceLed = (value: string) =>
    /\b(?:experi[eê]ncia\s+da\s+marca|contexto\s+de\s+uso|atmosfera\s+editorial|composi[cç][aã]o\s+(?:ampla|contextual)|cena\s+editorial|narrativa\s+contextual|tipografia\s+como\s+protagonista|tipografia\s+protagonista|cartaz\s+tipogr[aá]fico|design\s+gr[aá]fico\s+como\s+protagonista|mensagem\s+conduz\s+a\s+leitura|texto\s+conduz\s+a\s+leitura)\b/iu.test(
      value,
    );

  // A changed camera angle alone is not a separate creative concept. Require
  // opposing routes plus explicit, observable differences in three art-
  // direction axes so the prompts cannot collapse into the same layout.
  if (!((photoLed(first) && experienceLed(second)) || (experienceLed(first) && photoLed(second)))) {
    return [
      {
        reason: "SIMILAR_PROMPT_CONCEPTS",
        detail:
          "As opções precisam seguir estratégias distintas: uma conduzida pelo protagonista em plano próximo e outra por experiência, contexto de uso ou atmosfera editorial em composição ampla.",
      },
    ];
  }

  const normalizedFirst = normalizedWords(first);
  const normalizedSecond = normalizedWords(second);
  const axes = [
    {
      first:
        /\b(?:macro|close[- ]up|enquadramento\s+proximo|plano\s+fechado|detalhe\s+ampliado|tres\s+quartos)\b/u,
      second:
        /\b(?:zenital|vista\s+de\s+cima|vista\s+superior|top[- ]down|plano\s+aberto|visao\s+ampla|visao\s+geral)\b/u,
    },
    {
      first:
        /\b(?:ponto\s+focal|assimetric[ao]|area\s+negativa|espaco\s+negativo|produto\s+dominante|produto\s+ocupa)\b/u,
      second:
        /\b(?:composicao\s+(?:ampla|contextual)|leitura\s+em\s+camadas|cena\s+editorial|contexto\s+de\s+uso|atmosfera\s+editorial)\b/u,
    },
    {
      first:
        /\b(?:luz\s+(?:lateral|direcional|recortada|dram[aá]tica)|iluminacao\s+(?:lateral|direcional|dram[aá]tica)|contraluz)\b/u,
      second:
        /\b(?:luz\s+(?:difusa|uniforme|frontal)|iluminacao\s+(?:difusa|uniforme|frontal)|luz\s+suave\s+e\s+uniforme)\b/u,
    },
    {
      first:
        /\b(?:texto|tipografia)\s+(?:discreto|discreta|secund[aá]rio|secund[aá]ria|em\s+segundo\s+plano)|hierarquia\s+visual\s+liderada\s+pela\s+imagem|area\s+de\s+texto\b/u,
      second:
        /\b(?:texto\s+integrado\s+[àa]\s+cena|tipografia\s+organiza\s+a\s+mensagem|mensagem\s+integrada\s+[àa]\s+composicao|leitura\s+em\s+camadas|tipografia\s+como\s+protagonista|texto\s+conduz\s+a\s+leitura|grade\s+modular\s+organiza\s+a\s+leitura)\b/u,
    },
  ] as const;
  const divergentAxes = axes.filter(
    (axis) =>
      (axis.first.test(normalizedFirst) && axis.second.test(normalizedSecond)) ||
      (axis.second.test(normalizedFirst) && axis.first.test(normalizedSecond)),
  );
  if (divergentAxes.length < 3) {
    return [
      {
        reason: "SIMILAR_PROMPT_CONCEPTS",
        detail:
          "As opções devem declarar diferenças concretas em pelo menos três eixos entre enquadramento, composição, iluminação e hierarquia tipográfica. Especifique escolhas opostas para cada direção; não basta trocar adjetivos ou apenas a imagem.",
      },
    ];
  }

  // Fundos iguais derrubam a diferença visual: duas peças com o mesmo fundo
  // escuro (ou claro) renderizam quase iguais mesmo com eixos opostos. Só
  // reprova quando AMBAS declaram o mesmo lado; sem declaração, não julga.
  const darkBg = (value: string) =>
    /\b(?:fundo\s+(?:escuro|preto|profundo)|superficie\s+escura)\b/u.test(value);
  const lightBg = (value: string) =>
    /\b(?:fundo\s+(?:claro|branco|bege|creme)|superficie\s+clara)\b/u.test(value);
  if (
    (darkBg(normalizedFirst) && darkBg(normalizedSecond)) ||
    (lightBg(normalizedFirst) && lightBg(normalizedSecond))
  ) {
    return [
      {
        reason: "SIMILAR_PROMPT_CONCEPTS",
        detail:
          "As opções precisam ter fundos distintos: uma com fundo escuro, outra com fundo claro.",
      },
    ];
  }

  const stopWords = new Set([
    "para",
    "com",
    "sem",
    "uma",
    "um",
    "dos",
    "das",
    "que",
    "por",
    "mais",
    "sobre",
    "usar",
    "use",
    "deve",
    "devera",
    "banner",
    "imagem",
    "opcao",
    "prompt",
    "profissional",
    "publicitario",
    "publicitaria",
    "visual",
    "produto",
    "servico",
    "texto",
    "marca",
    "logo",
    "exatamente",
    "confirmado",
    "confirmada",
    "confirmados",
  ]);
  const tokens = (value: string) =>
    new Set(
      normalizedWords(value)
        .split(/\s+/u)
        .filter((word) => word.length > 3 && !stopWords.has(word)),
    );
  const a = tokens(first);
  const b = tokens(second);
  const union = new Set([...a, ...b]);
  if (union.size < 5) return [];
  const overlap = [...a].filter((word) => b.has(word)).length / union.size;
  return overlap >= 0.78
    ? [
        {
          reason: "SIMILAR_PROMPT_CONCEPTS",
          detail:
            "Os conceitos estão próximos demais; reescreva um com outra narrativa e composição.",
        },
      ]
    : [];
}

export type PromptResearchLeakViolation = {
  reason: "RESEARCH_DATA_LEAK";
  detail: string;
};

/** Prevent public registry/contact data from search snippets reaching a prompt. */
export function validatePromptNoRegistryData(prompt: string): PromptResearchLeakViolation[] {
  const registryTerms =
    /\b(?:cnpj|cpf|receita\s+federal|dados?\s+cadastrais?|informa[cç][õo]es?\s+de\s+registro|situa[cç][aã]o\s+cadastral|capital\s+social|natureza\s+jur[ií]dica|simples\s+nacional|regime\s+tribut[aá]rio|data\s+da\s+abertura|s[oó]ci[oa]s?|administrador(?:es)?|logradouro|cep|cnae|atividade\s+principal|contatos?\s+registrados?)\b/iu;
  const contactOrIdentifier =
    /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|(?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/iu;

  return registryTerms.test(prompt) || contactOrIdentifier.test(prompt)
    ? [
        {
          reason: "RESEARCH_DATA_LEAK",
          detail:
            "O prompt contém informação cadastral, identificador ou contato que não é referência visual nem dado comercial autorizado.",
        },
      ]
    : [];
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
  // A pergunta "Grátis ou Por conta da casa?" já está respondida quando o
  // cliente usou a própria expressão ou o briefing confirmou a cópia — sem
  // ela, o modelo pergunta de novo o que o cliente acabou de dizer.
  if (/\bcortesia\b/.test(normalized)) {
    if (brief?.freeCopyConfirmed) return true;
    const userConversation = messages.join("\n").toLocaleLowerCase("pt-BR");
    if (/\bgr[aá]tis\b|\bpor\s+conta\s+da\s+casa\b/.test(userConversation)) return true;
  }
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
