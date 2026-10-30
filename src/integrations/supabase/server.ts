// Sessão do Supabase em cookie httpOnly — lado servidor.
//
// O navegador nunca enxerga esses tokens via JS: login/logout/refresh
// acontecem em server functions (ver ./auth-session.functions.ts), que
// gravam o cookie com HttpOnly + Secure (só em produção) + SameSite=Lax.
// O middleware ./auth-middleware.ts lê e valida a sessão daqui.
//
// Decisão: sem @supabase/ssr (evita nova dependência e cirurgia no
// package-lock.json); o fluxo de cookie é pequeno o bastante para ser
// explícito e revisável.

import { createClient, type Session, type User } from "@supabase/supabase-js";
import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { supabaseDevFallback } from "./public-config";
import type { Database } from "./types";
import {
  LOGIN_ATTEMPT_WINDOW_MINUTES,
  LOGIN_RATE_LIMIT_MESSAGE,
  extractClientIp,
  shouldBlockLogin,
} from "./login-rate-limit";

// Nome fixo (não derivado da URL) para não quebrar entre ambientes.
export const SESSION_COOKIE_NAME = "sb-manostech-auth-token";
// Acompanha a vida útil do refresh token; a cada refresh o cookie é
// regravado com um novo maxAge.
const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 3600;

type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

function supabaseEnv(): { url: string; key: string } {
  const fallback = supabaseDevFallback();
  const url = process.env["SUPABASE_URL"] || fallback?.url;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || fallback?.publishableKey;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY. Configure them in your hosting provider before deploying.",
    );
  }
  return { url, key };
}

function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    // Secure só em produção: em dev (http://localhost) o navegador
    // rejeita cookie com Secure.
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax" as const,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

function anonClient() {
  const { url, key } = supabaseEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function setSessionCookie(session: {
  access_token: string;
  refresh_token: string;
  expires_at?: number | undefined;
}): void {
  const payload: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    ...(typeof session.expires_at === "number" ? { expires_at: session.expires_at } : {}),
  };
  setCookie(SESSION_COOKIE_NAME, encodeURIComponent(JSON.stringify(payload)), cookieOptions());
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
}

function readStoredSession(): StoredSession | null {
  let raw: string | undefined;
  try {
    raw = getCookie(SESSION_COOKIE_NAME);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<StoredSession>;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      ...(typeof parsed.expires_at === "number" ? { expires_at: parsed.expires_at } : {}),
    };
  } catch {
    return null;
  }
}

export type ServerSession = {
  accessToken: string;
  userId: string;
  claims: Record<string, unknown>;
  /** Tokens atuais (podem ter sido renovados durante a resolução). */
  tokens: StoredSession;
};

/**
 * Lê a sessão do cookie httpOnly, valida o access token e, se expirado,
 * renova com o refresh token (regravando o cookie). Retorna null quando
 * não há sessão válida — o cookie é limpo nesse caso.
 */
async function resolveSession(): Promise<ServerSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;
  const client = anonClient();

  const { data: claimsData, error: claimsError } = await client.auth.getClaims(stored.access_token);
  const sub = (claimsData?.claims as { sub?: string } | undefined)?.sub;
  if (!claimsError && sub && claimsData?.claims) {
    return {
      accessToken: stored.access_token,
      userId: sub,
      claims: claimsData.claims as Record<string, unknown>,
      tokens: stored,
    };
  }

  // Access token expirado/inválido → tenta o refresh.
  try {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: stored.refresh_token,
    });
    if (error || !data.session) {
      clearSessionCookie();
      return null;
    }
    setSessionCookie(data.session);
    const { data: refreshedClaims, error: refreshedError } = await client.auth.getClaims(
      data.session.access_token,
    );
    const refreshedSub = (refreshedClaims?.claims as { sub?: string } | undefined)?.sub;
    if (refreshedError || !refreshedSub || !refreshedClaims?.claims) {
      clearSessionCookie();
      return null;
    }
    return {
      accessToken: data.session.access_token,
      userId: refreshedSub,
      claims: refreshedClaims.claims as Record<string, unknown>,
      tokens: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        ...(typeof data.session.expires_at === "number"
          ? { expires_at: data.session.expires_at }
          : {}),
      },
    };
  } catch {
    clearSessionCookie();
    return null;
  }
}

export async function getServerSession(): Promise<Omit<ServerSession, "tokens"> | null> {
  const resolved = await resolveSession();
  if (!resolved) return null;
  const { tokens: _tokens, ...rest } = resolved;
  return rest;
}

/** Valida um access token contra o Supabase (usado pelo espelho de refresh). */
export async function validateAccessToken(accessToken: string): Promise<User | null> {
  try {
    const { data, error } = await anonClient().auth.getUser(accessToken);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Sessão completa para hidratar o client do navegador em memória
 * (primeiro acesso / reload). Os tokens voltam para a MEMÓRIA da aba —
 * nunca para localStorage/cookie legível por JS.
 */
export async function getServerSessionForClient(): Promise<Session | null> {
  const resolved = await resolveSession();
  if (!resolved) return null;
  const user = await validateAccessToken(resolved.accessToken);
  if (!user) return null;
  return {
    access_token: resolved.tokens.access_token,
    refresh_token: resolved.tokens.refresh_token,
    expires_in: 3600,
    ...(typeof resolved.tokens.expires_at === "number"
      ? { expires_at: resolved.tokens.expires_at }
      : {}),
    token_type: "bearer",
    user,
  };
}

/** Login no servidor: autentica e grava o cookie httpOnly.
 *
 * Rate limiting (item 2 da auditoria de login, 2026-10-30): antes de
 * tentar, conta as falhas recentes em login_attempts (via service_role)
 * e bloqueia força bruta — ver constantes em ./login-rate-limit.ts.
 * Cada tentativa é registrada; o sucesso zera as falhas do par
 * e-mail+IP. Se o banco falhar (ex.: migration ainda não aplicada), o
 * login segue (fail-open com log) — o rate limit nativo do Supabase
 * Auth continua como rede de proteção.
 */
export async function signInWithPasswordServer(email: string, password: string): Promise<Session> {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = currentClientIp();
  const { supabaseAdmin } = await import("./client.server");

  if (await isLoginBlocked(supabaseAdmin, normalizedEmail, ip)) {
    throw new Error(LOGIN_RATE_LIMIT_MESSAGE);
  }

  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  const success = !error && !!data.session && !!data.user;
  await recordLoginAttempt(supabaseAdmin, normalizedEmail, ip, success);
  if (!success) {
    // Mensagem neutra de propósito: não revela se o e-mail existe.
    throw new Error("Não foi possível entrar. Verifique e-mail e senha.");
  }
  setSessionCookie(data.session);
  return data.session;
}

// --- Rate limiting de login (item 2 da auditoria, 2026-10-30) ---
// Parâmetros e decisão pura em ./login-rate-limit.ts; aqui o acesso ao
// banco via service_role (tabela login_attempts, sem RLS pública).

type RateLimitAdminClient = (typeof import("./client.server"))["supabaseAdmin"];

/** IP do cliente na requisição atual ("" quando indisponível). */
function currentClientIp(): string {
  try {
    return extractClientIp(getRequest().headers);
  } catch {
    return "";
  }
}

function rateLimitWindowStartIso(): string {
  return new Date(Date.now() - LOGIN_ATTEMPT_WINDOW_MINUTES * 60_000).toISOString();
}

async function countRecentFailures(
  admin: RateLimitAdminClient,
  filter: { email?: string; ip?: string },
): Promise<number> {
  const windowStart = rateLimitWindowStartIso();
  let query = admin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("created_at", windowStart);
  if (filter.email !== undefined) query = query.eq("email", filter.email);
  if (filter.ip !== undefined) query = query.eq("ip", filter.ip);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

/** Verifica se o par e-mail+IP (ou o IP sozinho) estourou o limite de
 *  falhas na janela. Falha-aberto com log: nunca trava o painel por
 *  problema no banco. */
async function isLoginBlocked(
  admin: RateLimitAdminClient,
  email: string,
  ip: string,
): Promise<boolean> {
  try {
    const [emailIpFailures, ipFailures] = await Promise.all([
      countRecentFailures(admin, { email, ip }),
      ip ? countRecentFailures(admin, { ip }) : Promise.resolve(0),
    ]);
    return shouldBlockLogin({ emailIpFailures, ipFailures, ip });
  } catch (err) {
    console.error("[login-rate-limit] falha ao verificar bloqueio; liberando:", err);
    return false;
  }
}

/** Registra a tentativa; no sucesso, zera as falhas do par e-mail+IP. */
async function recordLoginAttempt(
  admin: RateLimitAdminClient,
  email: string,
  ip: string,
  success: boolean,
): Promise<void> {
  try {
    await admin.from("login_attempts").insert({ email, ip, success });
    if (success) {
      await admin
        .from("login_attempts")
        .delete()
        .eq("email", email)
        .eq("ip", ip)
        .eq("success", false);
    }
  } catch (err) {
    console.error("[login-rate-limit] falha ao registrar tentativa:", err);
  }
}

/** Logout no servidor: revoga os tokens e limpa o cookie. */ export async function destroyServerSession(): Promise<void> {
  const stored = readStoredSession();
  if (stored) {
    try {
      const { url, key } = supabaseEnv();
      const client = createClient<Database>(url, key, {
        global: { headers: { Authorization: `Bearer ${stored.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await client.auth.signOut();
    } catch {
      // Segue para limpar o cookie de qualquer forma.
    }
  }
  clearSessionCookie();
}
