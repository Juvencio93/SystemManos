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
    scrollRestoration: true,
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
