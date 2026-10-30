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
    // O client arma o limite máximo de sessão com este instante (ver ./client.ts).
    return { ok: true as const, session, sessionStartedAt: Date.now() };
  });

// Logout: revoga os tokens no servidor e limpa o cookie httpOnly.
export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { destroyServerSession } = await import("./server");
  await destroyServerSession();
  return { ok: true as const };
});

// Hidratação: devolve a sessão do cookie para o client em memória
// (primeiro acesso / reload). Sem sessão válida, retorna null — e, quando
// a sessão morreu pelos limites de duração, `expired` informa o motivo
// para o client deslogar localmente com mensagem amigável.
export const fetchSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerSessionForClient } = await import("./server");
  return getServerSessionForClient();
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
    const { validateAccessToken, setSessionCookie, getStoredSessionExpiry, clearSessionCookie } =
      await import("./server");
    const { expiryMessage } = await import("./session-limits");
    const user = await validateAccessToken(data.access_token);
    if (!user) throw new Error("Sessão inválida.");
    // Não estende sessão expirada: se os limites de duração estouraram,
    // limpa o cookie e recusa — o client desloga localmente (ver ./client.ts).
    const expired = getStoredSessionExpiry();
    if (expired) {
      clearSessionCookie();
      throw new Error(expiryMessage(expired));
    }
    // Só grava tokens que o próprio Supabase validou: o dono espelha a
    // PRÓPRIA sessão, sem escalada de privilégio. Preserva
    // session_started_at; desliza last_activity.
    setSessionCookie(data);
    return { ok: true as const };
  });
