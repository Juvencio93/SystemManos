import { ConversationResult } from "./chat-validation.functions";

/**
 * Trava de concorrência global no frontend para evitar múltiplas solicitações
 * de criação/busca de conversa simultâneas entre diferentes componentes
 * (ex: GlobalChatWidget e rota /mensagens).
 */
export const pendingConversationRequests = new Map<
  string,
  Promise<ConversationResult>
>();

/**
 * Helper para executar uma busca/criação de conversa com trava de concorrência.
 * A chave deve ser o ChatTarget canônico.
 */
export async function withConversationLock(
  targetKey: string,
  fn: () => Promise<ConversationResult>
): Promise<ConversationResult> {
  const existing = pendingConversationRequests.get(targetKey);
  if (existing) return existing;

  const promise = fn().finally(() => {
    pendingConversationRequests.delete(targetKey);
  });

  pendingConversationRequests.set(targetKey, promise);
  return promise;
}
