function normalizeIntentText(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Opens the prompt generator only when the user clearly asks to create visual
 * material. Merely mentioning images, visual identity or an existing banner is
 * a consulting question and must stay in the marketing conversation.
 */
export function isBannerCreationRequest(message: string): boolean {
  const normalized = normalizeIntentText(message);
  if (!normalized) return false;

  const explicitPrompt = /\bprompt\b.{0,30}\b(banner|arte|imagem|visual)\b|\b(banner|arte|imagem|visual)\b.{0,30}\bprompt\b/;
  if (explicitPrompt.test(normalized)) return true;

  const creationRequest =
    /\b(criar|crie|criacao|gerar|gere|montar|monte|fazer|faca|preparar|prepare|produzir|produza|elaborar|elabore|desenvolver|desenvolva)\b.{0,45}\b(banner|banners|arte|artes|imagem|imagens)\b/;

  return creationRequest.test(normalized);
}
