/**
 * Modo descrever do gerador de banners (substitui o chat).
 *
 * Funções puras, sem I/O, para o caminho novo: descrição livre vira
 * imagem gerada, com logo automática e fotos reais anexadas como
 * referências. Nada aqui toca rede, Storage ou banco — o servidor
 * (banner-describe.functions.ts) orquestra; aqui ficam as regras que
 * dá para testar sem provedor.
 */

/** A única frase de erro de API que o usuário vê. Nunca muda. */
export const DESCRIBE_GENERIC_ERROR = "Sistema indisponível no momento.";

/** Cota do produto: gerações de imagem por empresa por dia. */
export const DESCRIBE_QUOTA_LIMIT = 2;

/** Mensagem honesta de cota esgotada (não é erro de API). */
export const DESCRIBE_QUOTA_EXHAUSTED_MESSAGE =
  "Você já usou as 2 gerações de hoje. Volta amanhã para gerar de novo.";

/** Modelo de imagem: Nano Banana 2 Lite, 1K apenas. */
export const DESCRIBE_GEMINI_MODEL = "gemini-3.1-flash-lite-image";

/** Referências por geração: logo + fotos anexadas (a API aceita até 14). */
export const DESCRIBE_MAX_ATTACHMENTS = 4;

/** Fotos guardadas por empresa (links, nunca bytes no banco). */
export const DESCRIBE_MAX_STORED_ATTACHMENTS = 10;

/** Teto de cada foto anexada após o redimensionamento no navegador. */
export const DESCRIBE_MAX_ATTACHMENT_CHARS = 2_000_000;

export type DescribeQuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
};

export function describeQuotaStatus(used: number): DescribeQuotaStatus {
  const safeUsed = Math.max(0, Math.floor(used));
  const remaining = Math.max(0, DESCRIBE_QUOTA_LIMIT - safeUsed);
  return {
    used: safeUsed,
    limit: DESCRIBE_QUOTA_LIMIT,
    remaining,
    exhausted: remaining <= 0,
  };
}

export type DescribeAttachmentInput = {
  mimeType: string;
  /** Tamanho do data URL em caracteres (base64). */
  sizeChars: number;
};

const DESCRIBE_ATTACHMENT_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Validação server-side dos anexos (o cliente espelha estes tetos). */
export function validateDescribeAttachments(
  attachments: readonly DescribeAttachmentInput[],
): string[] {
  const errors: string[] = [];
  if (attachments.length > DESCRIBE_MAX_ATTACHMENTS) {
    errors.push(
      `No máximo ${DESCRIBE_MAX_ATTACHMENTS} fotos por geração.`,
    );
  }
  for (const attachment of attachments) {
    if (!DESCRIBE_ATTACHMENT_MIMES.has(attachment.mimeType)) {
      errors.push("Só valem fotos em PNG, JPEG ou WebP.");
    }
    if (attachment.sizeChars > DESCRIBE_MAX_ATTACHMENT_CHARS) {
      errors.push("Uma das fotos ficou grande demais para enviar.");
    }
  }
  return errors;
}

export type StoredDescribeAttachment = {
  id: string;
  createdAt: string;
};

/**
 * Limpeza das antigas: dada a lista ordenada da mais recente para a mais
 * antiga (já incluindo a nova), devolve os ids além do teto, para apagar
 * do banco e do Storage. Pura, para testar sem Supabase.
 */
export function describeAttachmentsToPrune(
  orderedNewestFirst: readonly StoredDescribeAttachment[],
): string[] {
  return orderedNewestFirst
    .slice(DESCRIBE_MAX_STORED_ATTACHMENTS)
    .map((row) => row.id);
}

/**
 * Rótulo interno de uma falha (log + alerta do ADM). Nunca vai para o
 * usuário e nunca carrega corpo de resposta, header ou chave.
 */
export function describeFailureLabel(kind: string, status?: number | undefined): string {
  if (kind === "missing_key") return "GEMINI_API_KEY ausente na Vercel";
  if (kind === "timeout") return "timeout na chamada de imagem";
  if (kind === "no_image") return "API respondeu sem imagem";
  if (kind === "validation") return "prompt reprovado pelos validadores";
  if (kind === "debit") return "falha ao registrar a geração na cota";
  if (status !== undefined) return `API de imagem: HTTP ${status}`;
  return `falha na geração (${kind})`;
}

export type DescribePromptParts = {
  /** Descrição corrigida e organizada, para mostrar ao usuário. */
  summary: string;
  /** Prompt técnico enviado ao modelo de imagem. */
  imagePrompt: string;
};

/**
 * O construtor de prompt devolve duas partes numa só resposta:
 * "RESUMO: ..." (uma ou duas frases) e "PROMPT: ..." (o resto).
 * Sem as duas marcas, usa o texto todo como prompt e o resumo vira a
 * descrição original aparada — nunca bloqueia a geração por formato.
 */
export function splitDescribePromptParts(
  raw: string,
  fallbackSummary: string,
): DescribePromptParts {
  const text = raw
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  const promptMark = text.search(/^PROMPT:\s*/m);
  const summaryMark = text.search(/^RESUMO:\s*/m);
  if (summaryMark >= 0 && promptMark > summaryMark) {
    const summary = text
      .slice(summaryMark + "RESUMO:".length, promptMark)
      .replace(/\s+/g, " ")
      .trim();
    const imagePrompt = text.slice(promptMark + "PROMPT:".length).trim();
    if (summary && imagePrompt) return { summary, imagePrompt };
  }
  if (promptMark >= 0) {
    const imagePrompt = text.slice(promptMark + "PROMPT:".length).trim();
    if (imagePrompt) {
      return { summary: fallbackSummary, imagePrompt };
    }
  }
  return { summary: fallbackSummary, imagePrompt: text };
}

/** Dia de hoje em America/Sao_Paulo (sem horário de verão desde 2019). */
export function todaySaoPaulo(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Início do dia de hoje em SP, como ISO com offset fixo -03:00. */
export function todayStartSaoPauloIso(now: Date = new Date()): string {
  return `${todaySaoPaulo(now)}T00:00:00-03:00`;
}
