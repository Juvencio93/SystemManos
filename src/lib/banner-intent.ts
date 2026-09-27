import { extractBannerTurnFacts } from "./banner-brief";

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

  const explicitPrompt =
    /\bprompt\b.{0,30}\b(banner|arte|imagem|visual)\b|\b(banner|arte|imagem|visual)\b.{0,30}\bprompt\b/;
  if (explicitPrompt.test(normalized)) return true;

  // A complete commercial message may be the first message in the dashboard.
  // Route it to the banner dialog so it receives the same semantic briefing
  // and compatibility handling as an explicit “criar banner” request.
  const facts = extractBannerTurnFacts(message, { pendingQuestion: "subject" });
  if (
    facts.subject &&
    (facts.price !== undefined ||
      facts.weekday !== undefined ||
      facts.commercialCondition !== undefined)
  )
    return true;

  const creationRequest =
    /\b(criar|crie|criacao|gerar|gere|montar|monte|fazer|faca|preparar|prepare|produzir|produza|elaborar|elabore|desenvolver|desenvolva)\b.{0,45}\b(banner|banners|arte|artes|imagem|imagens)\b/;

  return creationRequest.test(normalized);
}
