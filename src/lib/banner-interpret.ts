import { z } from "zod";
import type { BannerConversationBrief } from "./banner-brief";
import { extractOfferItems, isQualifierOnlySubject, normalizeWeekdayTypos } from "./banner-brief";

/**
 * Interpretação da conversa pela IA.
 *
 * O extrator determinístico casa padrões; ele não entende. Quando o cliente
 * responde "tudo junto" ("toda quarta feira, valor de 14,99 válidos para o
 * mês de novembro"), o determinístico pode transformar a frase em assunto e
 * gerar itens obrigatórios impossíveis. Aqui a IA lê a conversa e separa o
 * que é assunto, preço, dia e validade — e o determinístico confere cada
 * fato contra as mensagens antes de aceitar (grounding). Nada que não
 * esteja nas mensagens entra no brief. Em conflito, o determinístico vence
 * para preço/dia/validade (ele tem lógica explícita de correção); a IA
 * vence para assunto/itens só quando o assunto determinístico está
 * ausente ou contaminado por fatos.
 */

export const BannerInterpretationSchema = z.object({
  subject: z.string().trim().min(2).max(120).optional(),
  items: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  price: z.number().finite().nonnegative().optional(),
  weekday: z.string().trim().min(3).max(20).optional(),
  validity: z.string().trim().min(2).max(80).optional(),
  commercialCondition: z.string().trim().min(2).max(60).optional(),
  unit: z.string().trim().min(2).max(30).optional(),
});

export type BannerInterpretation = z.infer<typeof BannerInterpretationSchema>;

export type GroundedInterpretation = {
  subject?: string | undefined;
  items?: string[] | undefined;
  price?: number | undefined;
  weekday?: string | undefined;
  validity?: string | undefined;
  commercialCondition?: string | undefined;
  unit?: string | undefined;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const WEEKDAY_STEMS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
] as const;

const WEEKDAY_CANONICAL: Record<(typeof WEEKDAY_STEMS)[number], string> = {
  segunda: "segunda-feira",
  terca: "terça-feira",
  quarta: "quarta-feira",
  quinta: "quinta-feira",
  sexta: "sexta-feira",
  sabado: "sábado",
  domingo: "domingo",
};

const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
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

/** Palavras distintivas (o resto é conector e não prova nada). */
function distinctiveWords(value: string): string[] {
  return normalize(value)
    .split(/\s+/u)
    .filter((word) => word.length > 3);
}

export function parseBannerInterpretation(text: string): BannerInterpretation | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = BannerInterpretationSchema.safeParse(
      JSON.parse(candidate.slice(start, end + 1)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Assunto contaminado por fatos: carrega número de preço, palavra de
 * validade ou começa com dia da semana. É o sintoma da resposta "tudo
 * junto" virando assunto.
 */
export function isFactContaminatedSubject(subject: string | undefined): boolean {
  if (!subject) return false;
  const n = normalize(subject);
  // Assunto feito só de palavras funcionais ("toda") não é produto: veio de
  // resíduo de resposta de dia/recorrência. Conta como contaminado para a
  // interpretação da IA vencer o determinístico.
  const functionWords = new Set([
    "toda", "todo", "todas", "todos", "tota",
    "para", "pela", "pelo", "com", "sem", "sobre", "entre", "cada",
    "nesta", "neste", "nessa", "nesse", "das", "dos", "uma", "uns", "umas",
    "aos", "ao", "os", "as", "de", "da", "do", "em", "na", "no", "que", "e",
    "um", "a", "o", "por", "seu", "sua", "seus", "suas", "meu", "minha",
    "nos", "nas", "nosso", "nossa",
  ]);
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((word) => functionWords.has(word))) return true;
  // Desconto, hora e resíduo com vírgula final não são produto; assunto
  // só-qualificador ("diversos sabores") também não. Todos contam como
  // contaminados para a interpretação poder resgatar o assunto real.
  if (/\d+\s*%/.test(subject)) return true;
  if (/,\s*$/.test(subject)) return true;
  if (/\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b/.test(subject)) return true;
  if (isQualifierOnlySubject(subject)) return true;
  if (/\d+\s*,\s*\d{1,2}/.test(subject)) return true;
  if (/\br\$\s*\d/.test(subject)) return true;
  if (/\b\d+\s*(reais|pila|money)\b/.test(n)) return true;
  if (/valid/.test(n)) return true;
  if (
    /^(toda|todo|todas|todos)?\s*(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(n)
  )
    return true;
  if (/\bmes\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(n))
    return true;
  return false;
}

function weekdayStem(value: string): (typeof WEEKDAY_STEMS)[number] | undefined {
  const n = normalize(value);
  return WEEKDAY_STEMS.find((stem) => n.includes(stem));
}

/**
 * Confere cada fato da IA contra as mensagens do cliente. Fato sem lastro
 * nas mensagens é descartado — a IA sugere, o texto do cliente decide.
 */
export function groundInterpretation(
  interp: BannerInterpretation,
  userMessages: readonly string[],
): GroundedInterpretation {
  const grounded: GroundedInterpretation = {};
  const hayNormalized = normalize(normalizeWeekdayTypos(userMessages.join("\n")));
  const hayRaw = userMessages.join("\n").toLocaleLowerCase("pt-BR");

  if (interp.subject !== undefined) {
    const words = distinctiveWords(interp.subject);
    if (words.length > 0 && words.some((word) => hayNormalized.includes(word))) {
      grounded.subject = interp.subject;
    }
  }
  if (interp.items !== undefined) {
    const kept = interp.items.filter((item) => {
      const words = distinctiveWords(item);
      return words.length > 0 && words.some((word) => hayNormalized.includes(word));
    });
    if (kept.length > 0) grounded.items = kept;
  }
  if (interp.price !== undefined) {
    const br = interp.price.toFixed(2).replace(".", ",");
    const us = interp.price.toFixed(2);
    const int = Number.isInteger(interp.price) ? String(interp.price) : null;
    if (
      hayRaw.includes(br) ||
      hayRaw.includes(us) ||
      (int !== null && new RegExp(`\\b${int}\\b`).test(hayRaw))
    ) {
      grounded.price = interp.price;
    }
  }
  if (interp.weekday !== undefined) {
    const stem = weekdayStem(interp.weekday);
    if (stem !== undefined && hayNormalized.includes(stem)) {
      grounded.weekday = WEEKDAY_CANONICAL[stem];
    }
  }
  if (interp.validity !== undefined) {
    const words = distinctiveWords(interp.validity);
    const hasMonth = MONTHS.some(
      (month) => hayNormalized.includes(month) && normalize(interp.validity ?? "").includes(month),
    );
    if (hasMonth || (words.length > 0 && words.some((word) => hayNormalized.includes(word)))) {
      grounded.validity = interp.validity;
    }
  }
  if (interp.commercialCondition !== undefined) {
    const words = distinctiveWords(interp.commercialCondition);
    if (words.length > 0 && words.some((word) => hayNormalized.includes(word))) {
      grounded.commercialCondition = interp.commercialCondition;
    }
  }
  if (interp.unit !== undefined) {
    if (hayNormalized.includes(normalize(interp.unit))) {
      grounded.unit = interp.unit;
    }
  }
  return grounded;
}

/**
 * Junta o brief determinístico com a interpretação conferida. Assunto e
 * itens vêm de uma única fonte: a IA só assume quando o determinístico
 * está ausente ou contaminado. Preço, dia, validade, condição e unidade:
 * o determinístico vence se já tiver o valor; a IA só preenche lacuna.
 */
export function mergeInterpretedBrief(
  deterministic: BannerConversationBrief,
  grounded: GroundedInterpretation,
): BannerConversationBrief {
  const merged: BannerConversationBrief = { ...deterministic };
  const detSubject = deterministic.subject;
  if (grounded.subject !== undefined) {
    if (detSubject === undefined || isFactContaminatedSubject(detSubject)) {
      merged.subject = grounded.subject;
      merged.offerItems =
        grounded.items !== undefined && grounded.items.length > 0
          ? grounded.items
          : extractOfferItems(grounded.subject);
    }
  }
  if (merged.price === undefined && grounded.price !== undefined) {
    merged.price = grounded.price;
  }
  if (merged.weekday === undefined && grounded.weekday !== undefined) {
    merged.weekday = grounded.weekday;
    if (!merged.weekdays?.length) merged.weekdays = [grounded.weekday];
  }
  if (merged.validity === undefined && grounded.validity !== undefined) {
    merged.validity = grounded.validity;
  }
  if (merged.commercialCondition === undefined && grounded.commercialCondition !== undefined) {
    merged.commercialCondition = grounded.commercialCondition;
  }
  if (merged.unit === undefined && grounded.unit !== undefined) {
    merged.unit = grounded.unit;
  }
  return merged;
}

export const BANNER_INTERPRETATION_SYSTEM = `Você interpreta pedidos de banner. Leia a conversa e devolva SOMENTE um JSON com os fatos que o cliente afirmou, sem inventar nada. Separe cada coisa no campo certo: subject é SÓ o que será divulgado (produto, serviço ou oferta — nunca inclua dia, preço ou validade nele); items é a lista dos produtos/serviços da oferta; price é o preço como número (ex.: 14.99); weekday é o dia da semana (ex.: quarta-feira); validity é o período (ex.: mês de novembro); commercialCondition é uma condição especial (ex.: por conta da casa) quando houver; unit é a unidade do preço (ex.: unidade, porção) quando houver. Omita qualquer campo que o cliente não disse. Não inclua dia, preço ou validade dentro de subject ou items. Responda SOMENTE com o JSON, sem texto antes ou depois.`;

/**
 * Interpreta a conversa com a IA e devolve o brief fundido, ou null quando
 * a interpretação falha ou nada muda. Nunca bloqueia o fluxo: qualquer
 * falha cai para o brief determinístico.
 */
export async function interpretBannerBrief(
  userMessages: readonly string[],
  deterministic: BannerConversationBrief,
  call: (system: string, user: string) => Promise<{ ok: boolean; text: string | null }>,
): Promise<BannerConversationBrief | null> {
  if (userMessages.length === 0) return null;
  const numbered = userMessages.map((m, i) => `${i + 1}. ${m}`).join("\n");
  let result: { ok: boolean; text: string | null };
  try {
    result = await call(
      BANNER_INTERPRETATION_SYSTEM,
      `Conversa do cliente (mensagens, em ordem):\n${numbered}\n\nLeitura determinística atual (apoio; pode estar incompleta ou errada): ${JSON.stringify(deterministic)}\n\nResponda SOMENTE com o JSON.`,
    );
  } catch {
    return null;
  }
  if (!result.ok || !result.text) return null;
  const parsed = parseBannerInterpretation(result.text);
  if (!parsed) return null;
  const grounded = groundInterpretation(parsed, userMessages);
  if (Object.keys(grounded).length === 0) return null;
  const merged = mergeInterpretedBrief(deterministic, grounded);
  return merged;
}
