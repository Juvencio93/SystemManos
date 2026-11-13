// Anti-bot (item 12 da auditoria de segurança, 2026-11-12): verificação
// server-side do token do Cloudflare Turnstile (grátis).
//
// O widget (src/components/turnstile-widget.tsx) gera o token no navegador
// e o front o envia junto com o formulário; ESTE módulo confere o token
// na API da Cloudflare ANTES de processar o pedido. A SECRET KEY
// (TURNSTILE_SECRET_KEY) só existe no servidor — nunca vai para o front,
// para docs ou para a PR.
//
// Fail-open DOCUMENTADO (não é descuido):
// - Sem TURNSTILE_SECRET_KEY configurada, a verificação é ignorada com
//   aviso no log — o painel não pode travar o login do ADM por falta de
//   configuração. Configurar a chave no Vercel (Production e Preview)
//   ativa a proteção.
// - Se a API da Cloudflare não responder (rede/timeout), o pedido segue
//   com erro no log — uma queda da Cloudflare não pode trancar todo mundo
//   pra fora do painel.
// Token ausente ou rejeitado pela Cloudflare SEMPRE recusa o pedido.

// Mensagens amigáveis (pt-BR) — nunca vazar JSON cru nem detalhe técnico.
export const TURNSTILE_REQUIRED_MESSAGE =
  "Confirme que você não é um robô antes de continuar.";
export const TURNSTILE_FAILED_MESSAGE =
  "Não foi possível confirmar que você não é um robô. Atualize a verificação e tente de novo.";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8000;

export type TurnstileVerification =
  | { ok: true; skipped: boolean }
  | { ok: false; errorCodes: string[] };

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env["TURNSTILE_SECRET_KEY"]);
}

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

/**
 * Confere o token do Turnstile na API da Cloudflare. `remoteIp` é
 * opcional (a Cloudflare aceita verificar sem ele); passe quando o
 * chamador já tiver o IP real do visitante.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerification> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    console.warn(
      "[turnstile] TURNSTILE_SECRET_KEY não configurada — verificação ignorada (fail-open até configurar).",
    );
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, errorCodes: ["missing-input-response"] };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    const data = (await res.json()) as SiteverifyResponse;
    if (data?.success === true) return { ok: true, skipped: false };
    return { ok: false, errorCodes: data?.["error-codes"] ?? ["unknown"] };
  } catch (err) {
    // Rede/timeout ao falar com a Cloudflare: fail-open com log (ver o
    // comentário no topo do arquivo).
    console.error("[turnstile] falha ao verificar token (fail-open):", err);
    return { ok: true, skipped: true };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Porta de entrada dos handlers: verifica e recusa com erro amigável em
 * pt-BR quando o token falta ou é rejeitado. Chamar ANTES de processar
 * o pedido (login, reset, pré-venda, privacidade).
 */
export async function assertTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<void> {
  const result = await verifyTurnstileToken(token, remoteIp);
  if (result.ok) return;
  if (result.errorCodes.includes("missing-input-response")) {
    throw new Error(TURNSTILE_REQUIRED_MESSAGE);
  }
  console.warn("[turnstile] token rejeitado:", result.errorCodes.join(","));
  throw new Error(TURNSTILE_FAILED_MESSAGE);
}
