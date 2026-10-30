import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Sessão via cookie httpOnly — server functions públicas de autenticação.
// Chamadas pelo navegador (login/logout/hidratação). Protegidas contra
// CSRF pelo createCsrfMiddleware global (src/start.ts).
//
// Os imports de ./server são dinâmicos de propósito: esse módulo é
// importado pelo client, e ./server puxa @tanstack/react-start/server.

const credentials = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

// Login: autentica NO SERVIDOR e grava o cookie httpOnly. A resposta traz
// a sessão para hidratar o client em memória imediatamente (sem ela, o
// realtime/storage/chamadas diretas do navegador ficariam sem token até
// o próximo reload).
export const signInFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => credentials.parse(data))
  .handler(async ({ data }) => {
    const { signInWithPasswordServer } = await import("./server");
    const session = await signInWithPasswordServer(data.email, data.password);
    return { ok: true as const, session };
  });

// Logout: revoga os tokens no servidor e limpa o cookie httpOnly.
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { destroyServerSession } = await import("./server");
  await destroyServerSession();
  return { ok: true as const };
});

// Hidratação: devolve a sessão do cookie para o client em memória
// (primeiro acesso / reload). Sem sessão válida, retorna null.
export const fetchSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerSessionForClient } = await import("./server");
  const session = await getServerSessionForClient();
  return { session };
});

// Espelho do refresh: o client renova o token sozinho (autoRefreshToken);
// este endpoint valida os tokens novos e atualiza o cookie httpOnly,
// evitando divergência entre a memória do navegador e o cookie.
const refreshedSession = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10),
  expires_at: z.number().optional(),
});

export const syncRefreshedSessionFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => refreshedSession.parse(data))
  .handler(async ({ data }) => {
    const { validateAccessToken, setSessionCookie } = await import("./server");
    const user = await validateAccessToken(data.access_token);
    if (!user) throw new Error("Sessão inválida.");
    // Só grava tokens que o próprio Supabase validou: o dono espelha a
    // PRÓPRIA sessão, sem escalada de privilégio.
    setSessionCookie(data);
    return { ok: true as const };
  });
