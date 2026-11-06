import type { QueryClient } from "@tanstack/react-query";

/**
 * Polling do painel (Frente 1 — auditoria de logs do Supabase).
 *
 * Dois problemas corrigidos aqui:
 * 1. `retry: 1` (padrão global) dobrava cada falha de polling. Queries de
 *    polling usam `retry: false`.
 * 2. O polling nunca parava em erro: com o Supabase fora, cada ciclo
 *    refazia o fetch para sempre. `pollingInterval` devolve `false` após
 *    N erros consecutivos, e o TanStack para o timer (a query volta a
 *    rodar no próximo mount/invalidate manual; no sucesso o contador
 *    zera e o timer recomeça).
 *
 * Detalhe verificado no @tanstack/query-core 5.104.0 instalado:
 * - a forma funcional de `refetchInterval` é reavaliada após cada fetch
 *   (`updateResult` → `#computeRefetchInterval`);
 * - `fetchFailureCount` NÃO serve para contar erros consecutivos: cada
 *   fetch novo zera o contador (ele só conta retries dentro de um mesmo
 *   fetch). Por isso o contador vive no closure e usa `errorUpdatedAt`
 *   para não contar o mesmo erro duas vezes.
 */

export const POLLING_MAX_CONSECUTIVE_ERRORS = 3;

type QueryStateLike = {
  status?: string;
  errorUpdatedAt?: number;
};

/** Decisão pura (testável) a partir do estado da query + contador. */
export function shouldKeepPolling(
  consecutiveErrors: number,
  maxConsecutiveErrors: number = POLLING_MAX_CONSECUTIVE_ERRORS,
): boolean {
  return consecutiveErrors < maxConsecutiveErrors;
}

/**
 * Intervalo de polling que pausa após `maxConsecutiveErrors` erros
 * consecutivos. Uso:
 * `refetchInterval: pollingInterval(queryClient, ["minha-chave"], 120_000)`.
 *
 * O TanStack passa a Query como argumento da função; o fallback
 * `getQueryState` cobre chamadas sem argumento.
 */
export function pollingInterval(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  intervalMs: number,
  maxConsecutiveErrors: number = POLLING_MAX_CONSECUTIVE_ERRORS,
): (data: unknown) => number | false {
  let consecutiveErrors = 0;
  let lastErrorUpdatedAt = 0;
  return (queryOrData: unknown) => {
    const state: QueryStateLike | undefined =
      (queryOrData as { state?: QueryStateLike } | null)?.state ??
      queryClient.getQueryState(queryKey);
    if (state?.status === "error") {
      const errorUpdatedAt = state.errorUpdatedAt ?? 0;
      if (errorUpdatedAt !== lastErrorUpdatedAt) {
        lastErrorUpdatedAt = errorUpdatedAt;
        consecutiveErrors += 1;
      }
    } else if (state?.status === "success") {
      consecutiveErrors = 0;
      lastErrorUpdatedAt = 0;
    }
    return shouldKeepPolling(consecutiveErrors, maxConsecutiveErrors)
      ? intervalMs
      : false;
  };
}
