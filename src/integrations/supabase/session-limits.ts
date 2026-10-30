// Limites de duração da sessão (item 3 da auditoria de login, 2026-10-30).
//
// Duas regras, avaliadas no SERVIDOR (o dono da sessão — ver ./server.ts):
// - IDLE_TIMEOUT_MINUTES: a sessão expira após N minutos sem requisição
//   autenticada (o timestamp `last_activity` desliza a cada request).
// - MAX_SESSION_HOURS: a sessão expira N horas após o login, mesmo com
//   atividade contínua (`session_started_at` nunca é estendido).
//
// Os timestamps viajam no cookie httpOnly junto aos tokens (ver
// ./server.ts). O navegador espelha a checagem (ver ./client.ts) para que
// a sessão em memória morra junto — sem isso, o auto-refresh do
// supabase-js manteria o painel utilizável após a expiração do cookie.

/** Minutos sem requisição autenticada até a sessão expirar. */
export const IDLE_TIMEOUT_MINUTES = 30;
/** Horas desde o login até a expiração absoluta da sessão. */
export const MAX_SESSION_HOURS = 12;

export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60_000;
export const MAX_SESSION_MS = MAX_SESSION_HOURS * 3_600_000;

export const SESSION_IDLE_MESSAGE = "Sua sessão expirou por inatividade. Entre novamente.";
export const SESSION_MAX_MESSAGE = "Sua sessão expirou. Entre novamente.";

export type SessionExpiryReason = "idle" | "max";

export function expiryMessage(reason: SessionExpiryReason): string {
  return reason === "idle" ? SESSION_IDLE_MESSAGE : SESSION_MAX_MESSAGE;
}

/** Mensagens de expiração vindas de server functions (erros serializados). */
export function sessionExpiryReasonFromMessage(message: string): SessionExpiryReason | null {
  if (message === SESSION_IDLE_MESSAGE) return "idle";
  if (message === SESSION_MAX_MESSAGE) return "max";
  return null;
}

export type SessionTimestamps = {
  session_started_at?: number | undefined;
  last_activity?: number | undefined;
};

/**
 * Lógica pura da expiração (testável). `now` em ms (Date.now()).
 *
 * Cookies legados sem timestamps ganham vida nova a partir de `now`
 * (upgrade gracioso — passam a ser rastreados daqui em diante).
 * Quando ambos os limites estouram, o idle tem precedência na mensagem.
 */
export function checkSessionExpiry(
  timestamps: SessionTimestamps,
  now: number = Date.now(),
): SessionExpiryReason | null {
  const startedAt = timestamps.session_started_at ?? now;
  const lastActivity = timestamps.last_activity ?? startedAt;
  if (now - lastActivity > IDLE_TIMEOUT_MS) return "idle";
  if (now - startedAt > MAX_SESSION_MS) return "max";
  return null;
}
