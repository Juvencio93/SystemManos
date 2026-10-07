type PagBankErrorPayload = {
  error_messages?: Array<{ description?: string; message?: string }>;
  message?: string;
};

export const PAGBANK_PRODUCTION_APPROVAL_MESSAGE =
  "Sua conta PagBank ainda não foi liberada para usar a API em produção. Aguarde a aprovação da homologação pelo PagBank ou selecione Sandbox para continuar os testes.";

export function getPagBankErrorMessage(
  payload: PagBankErrorPayload | string | null | undefined,
  status: number,
) {
  const rawMessage =
    typeof payload === "string"
      ? payload
      : payload?.error_messages?.[0]?.description ||
        payload?.error_messages?.[0]?.message ||
        payload?.message ||
        "";
  const normalized = rawMessage.toLocaleLowerCase("en-US");

  if (
    normalized.includes("whitelist access required") ||
    normalized.includes("contact pagseguro")
  ) {
    return PAGBANK_PRODUCTION_APPROVAL_MESSAGE;
  }

  if (status === 401 || status === 403) {
    return "O PagBank recusou o acesso. Confira se o token pertence ao ambiente selecionado e se está ativo.";
  }

  return rawMessage || `PagBank retornou erro ${status}.`;
}

export function isPagBankProductionApprovalPending(message?: string | null) {
  if (!message) return false;
  const normalized = message.toLocaleLowerCase("pt-BR");
  return (
    normalized.includes("whitelist access required") ||
    normalized.includes("contact pagseguro") ||
    normalized.includes("ainda não foi liberada para usar a api em produção")
  );
}
