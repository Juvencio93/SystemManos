// 2FA (TOTP) para o ADM — item 4 da auditoria de login (2026-10-30).
//
// Usa o MFA nativo do Supabase Auth (mfa.enroll/challenge/verify/unenroll);
// este módulo só tem constantes e lógica pura (importável com segurança no
// bundle do cliente). O estado entre as etapas do login (tokens aal1)
// viaja num cookie httpOnly de curta duração que só autoriza a verificação
// do código — ver ./server.ts. A sessão plena (cookie) só é emitida DEPOIS
// do TOTP verificado.
//
// Anti-lockout: se o ADM perder o autenticador, a aprovação de uma
// redefinição de senha remove os fatores 2FA (ver
// @/lib/password-reset.functions.ts) e o próximo acesso recadastra o
// autenticador — o enrollment é obrigatório para ADM sem fator.

/** Vida útil do cookie de verificação pendente, em segundos. */
export const MFA_PENDING_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/** Códigos errados tolerados por e-mail+IP dentro da janela antes do
 *  bloqueio. Mais folgado que o do login (10 vs 5): digitar o código
 *  errado 1-2x é normal, e 10 tentativas/15min não ameaçam um TOTP de
 *  6 dígitos. */
export const MFA_VERIFY_MAX_FAILURES_PER_EMAIL_IP = 10;
/** Códigos errados tolerados por IP (qualquer e-mail) dentro da janela. */
export const MFA_VERIFY_MAX_FAILURES_PER_IP = 20;
/** Janela deslizante de contagem das tentativas de código, em minutos. */
export const MFA_VERIFY_ATTEMPT_WINDOW_MINUTES = 15;

/** Mensagem quando o bloqueio de tentativas de código dispara. Neutra de
 *  propósito: conta tentativas, não revela nada sobre a conta. */
export const MFA_VERIFY_RATE_LIMIT_MESSAGE =
  "Muitas tentativas de código. Aguarde alguns minutos e tente de novo.";
/** O cookie de verificação expirou (10 min) ou o fator sumiu no meio do
 *  caminho — volta pro login com e-mail e senha. */
export const MFA_PENDING_EXPIRED_MESSAGE =
  "Sessão de verificação expirada. Entre novamente com e-mail e senha.";
/** Código errado ou desafio inválido: mensagem única para não virar
 *  oráculo sobre qual etapa falhou. */
export const MFA_INVALID_CODE_MESSAGE =
  "Código inválido. Confira no app autenticador e tente de novo.";

export type MfaLoginStep = "none" | "verify" | "enroll";

/**
 * Decide a etapa pós-senha do login. Só o ADM passa pelo 2FA; ADM sem
 * fator verificado cai no enrollment obrigatório (é assim que o 2FA
 * nasce para contas existentes — sem tela separada de "ativar").
 */
export function decideMfaStep(args: { isAdm: boolean; verifiedTotpCount: number }): MfaLoginStep {
  if (!args.isAdm) return "none";
  return args.verifiedTotpCount > 0 ? "verify" : "enroll";
}

/**
 * Decide se a verificação do código deve ser bloqueada a partir das
 * contagens de falhas recentes (dentro da janela). `ip` vazio = IP
 * desconhecido: a contagem por IP é ignorada (evita bloquear todo
 * mundo junto).
 */
export function shouldBlockMfaVerify(args: {
  emailIpFailures: number;
  ipFailures: number;
  ip: string;
}): boolean {
  if (args.emailIpFailures >= MFA_VERIFY_MAX_FAILURES_PER_EMAIL_IP) return true;
  if (args.ip && args.ipFailures >= MFA_VERIFY_MAX_FAILURES_PER_IP) return true;
  return false;
}
