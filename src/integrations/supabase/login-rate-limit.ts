// Rate limiting de login — lógica pura (sem dependências de servidor),
// testável em isolamento e importável com segurança no bundle do cliente.
// O acesso ao banco (contagem/registro em login_attempts via service_role)
// vive em ./server.ts; os parâmetros abaixo ajustam o comportamento.

/** Falhas toleradas por e-mail+IP dentro da janela antes do bloqueio. */
export const LOGIN_MAX_FAILURES_PER_EMAIL_IP = 5;
/** Falhas toleradas por IP (qualquer e-mail) dentro da janela. Limite
 *  mais alto: protege contra varredura de e-mails sem travar usuários
 *  legítimos atrás do mesmo NAT. */
export const LOGIN_MAX_FAILURES_PER_IP = 20;
/** Janela deslizante de contagem, em minutos. */
export const LOGIN_ATTEMPT_WINDOW_MINUTES = 15;

/** Mensagem exibida quando o bloqueio dispara. Neutra de propósito: o
 *  bloqueio conta tentativas, não existência de conta — não revela se
 *  o e-mail está cadastrado. */
export const LOGIN_RATE_LIMIT_MESSAGE =
  "Muitas tentativas de acesso. Aguarde alguns minutos e tente de novo.";

/**
 * Extrai o IP do cliente dos cabeçalhos. Usa a ÚLTIMA entrada do
 * X-Forwarded-For — a acrescentada pelo proxy de borda (ex.: Vercel);
 * a primeira pode ser forjada pelo próprio cliente, então não serve
 * para um controle de segurança. Fallbacks: X-Real-IP, CF-Connecting-IP.
 * Retorna "" quando indisponível (nesse caso só a chave e-mail+IP conta).
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  return "";
}

/**
 * Decide se o login deve ser bloqueado a partir das contagens de falhas
 * recentes (dentro da janela). `ip` vazio = IP desconhecido: nesse caso
 * a contagem por IP é ignorada (evita bloquear todo mundo junto).
 */
export function shouldBlockLogin(args: {
  emailIpFailures: number;
  ipFailures: number;
  ip: string;
}): boolean {
  if (args.emailIpFailures >= LOGIN_MAX_FAILURES_PER_EMAIL_IP) return true;
  if (args.ip && args.ipFailures >= LOGIN_MAX_FAILURES_PER_IP) return true;
  return false;
}
