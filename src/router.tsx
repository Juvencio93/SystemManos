import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Evita refetch imediato ao trocar de rota / remontar componentes,
        // deixando a navegação instantânea com dados já em cache.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // A landing ("/") NUNCA pode ter a rolagem movida pelo router: o
    // scrollRestoration do TanStack Router roda em todo onRendered
    // (inclusive em router.invalidate() disparado por evento de auth) e
    // restaura a posição a partir de um cache que só é atualizado ao
    // navegar/sair da página — ou seja, um re-render tardio pode devolver
    // a vista para uma posição velha (ou para o topo) no meio da leitura.
    // A landing é uma página pública e estática, sem dado de loader que
    // dependa de sessão: não há nada para o invalidate repor nela, e
    // voltar para "/" pelo botão de voltar cair no topo é aceitável.
    // As demais rotas mantêm a restauração normal.
    scrollRestoration: ({ location }) => location.pathname !== "/",
    // Prefetch das rotas ao passar o mouse / focar nos links.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30_000,
    // Evita "piscadas" de loading em transições rápidas.
    defaultPendingMs: 300,
    defaultPendingMinMs: 200,
  });

  return router;
};
