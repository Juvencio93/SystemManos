import { sendMessage } from "@/lib/chat.functions";
import { isValidUuid } from "@/lib/uuid";

export type SendChatMessageInput = {
  conversationId: string;
  clientMessageId: string;
  content: string;
  event?: string;
  replyToMessageId?: string | null;
  attachments?: Array<{
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
};

export async function sendChatMessage(input: SendChatMessageInput) {
  if (!isValidUuid(input.conversationId)) {
    throw new Error("Não foi possível enviar: conversa inválida.");
  }

  const content = input.content.trim();
  const hasAttachments = Boolean(input.attachments?.length);
  if (!content && !hasAttachments) {
    throw new Error("Não foi possível enviar uma mensagem vazia.");
  }

  return sendMessage({
    data: {
      conversationId: input.conversationId,
      clientMessageId: input.clientMessageId,
      content,
      event: input.event,
      replyToMessageId: input.replyToMessageId,
      attachments: input.attachments,
    },
  });
}

