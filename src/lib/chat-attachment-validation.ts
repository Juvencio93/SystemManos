/**
 * Regras de upload do bucket `chat_attachments` — fonte única de verdade
 * usada pelo front (rejeição rápida, com mensagem amigável) e pela server
 * function `sendMessage` (validação server-side do que foi de fato gravado
 * no Storage).
 *
 * Por que existe este módulo: até a Frente 6, tipo/tamanho só eram
 * validados no navegador e o bucket não tinha `file_size_limit` nem
 * `allowed_mime_types`. O upload vai direto do navegador para o Storage e
 * o `sendMessage` confiava no que o cliente declarava — qualquer upload
 * direto pela API do Storage passava sem barreira. Agora o bucket impõe a
 * allowlist e o teto de 20 MB (migration
 * `20261123162000_chat_attachments_allowed_mime_types`) e o servidor
 * confere o objeto gravado antes de criar a mensagem.
 *
 * Decisão do teto: o front já promete 20 MB e o bucket sobe para 20 MB
 * (era sem limite). 20 MB cabe no plano Supabase (o teto global de
 * arquivo do plano Free é 50 MB).
 *
 * Alinhamento (Frente 6): a tela de mensagens aceitava GIF e o widget de
 * chat não — a allowlist é JPEG/PNG/WebP/PDF nos dois, igual ao relatório
 * da revisão. GIF sai da tela de mensagens.
 */

/** Nome do bucket de anexos do chat (privado, acesso por URL assinada de 1h). */
export const CHAT_ATTACHMENTS_BUCKET = "chat_attachments";

/** Allowlist do bucket — os únicos tipos que o front aceita. */
export const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type ChatAttachmentMimeType =
  (typeof CHAT_ATTACHMENT_ALLOWED_MIME_TYPES)[number];

/** Teto do bucket (migration): 20 MB — igual ao prometido no front. */
export const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export interface ChatAttachmentClaim {
  mimeType: string;
  size: number;
}

/**
 * Valida um anexo (declarado ou gravado) contra a regra do bucket.
 * Devolve a mensagem de erro em pt-BR ou null quando está na regra.
 * Mesmas mensagens do front, para o usuário ver o mesmo texto nos dois
 * caminhos.
 */
export function validateChatAttachmentClaim({
  mimeType,
  size,
}: ChatAttachmentClaim): string | null {
  if (
    !(
      CHAT_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]
    ).includes(mimeType)
  ) {
    return "Envie somente imagens ou arquivos PDF.";
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_CHAT_ATTACHMENT_BYTES) {
    return "O arquivo excede o limite máximo de 20 MB.";
  }
  return null;
}
