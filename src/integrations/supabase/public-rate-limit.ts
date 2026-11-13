// Rate limit de endpoints públicos (reset de senha, pré-venda) — lógica
// pura (sem dependências de servidor), testável em isolamento e importável
// com segurança no bundle do cliente.
//
// O consumo do limite usa a RPC `consume_portal_checkin_rate_limit` — o
// MESMO mecanismo do portal (10/min/IP; ver portal.functions.ts e
// privacy.functions.ts). Sem migration nova: a RPC e a tabela
// `portal_checkin_rate_limits` já existem desde 2026-09 (service_role).
//
// Fail-open (mesmo padrão do login — server.ts `isLoginBlocked`): se a
// RPC falhar, o pedido segue e o erro vai para o log do servidor; o
// banco é necessário de qualquer forma para registrar o pedido, então
// uma pane no banco barra o pedido na consulta seguinte.

/** Tentativas toleradas por IP dentro da janela (mesmo padrão do portal). */
export const PUBLIC_RATE_LIMIT_PER_IP = 10;
/** Janela do limite, em segundos. */
export const PUBLIC_RATE_WINDOW_SECONDS = 60;

/** Balde do reset de senha na RPC do portal. */
export const PASSWORD_RESET_RATE_LIMIT_BUCKET = "password_reset";
/** Balde da pré-venda: submit, parcial e conclusão compartilham o balde
 *  (o fluxo legítimo em 2 passos usa 2 tentativas por minuto). */
export const PRE_SALE_RATE_LIMIT_BUCKET = "pre_sale";

/** Mensagem quando o limite estoura. Neutra de propósito: sem detalhe
 *  técnico, sem revelar como o limite é contado. */
export const PUBLIC_RATE_LIMIT_EXCEEDED_MESSAGE =
  "Muitas tentativas. Aguarde um minuto e tente novamente.";

/** Monta a chave do balde da RPC a partir do prefixo e do IP do cliente. */
export function publicRateLimitBucket(prefix: string, ip: string): string {
  return `${prefix}:${ip}`;
}
