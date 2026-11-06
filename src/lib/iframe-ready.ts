/**
 * O documento dentro do iframe já está pronto para mostrar?
 *
 * "interactive" = o HTML foi lido (o formulário do portal já está visível);
 * "complete" = tudo carregado. "loading" (ou sem documento) = ainda não.
 *
 * O acesso a contentDocument pode falhar (iframe de outra origem) — nesse
 * caso responde "não pronto" e quem chama usa outro caminho (onLoad / teto).
 */
export function isFrameDocumentReady(
  frame: { contentDocument?: { readyState?: string } | null } | null | undefined,
): boolean {
  try {
    const state = frame?.contentDocument?.readyState;
    return state === "interactive" || state === "complete";
  } catch {
    return false;
  }
}
