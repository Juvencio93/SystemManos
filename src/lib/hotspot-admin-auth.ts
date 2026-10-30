import { createClient } from "@supabase/supabase-js";
import { supabaseDevFallback } from "@/integrations/supabase/public-config";
import { SESSION_COOKIE_NAME } from "@/integrations/supabase/server";
import type { Database } from "@/integrations/supabase/types";

async function userIdFromJwt(jwt: string): Promise<string | null> {
  if (!jwt || jwt.split(".").length !== 3) return null;

  const fallback = supabaseDevFallback();
  const url = process.env["SUPABASE_URL"] || fallback?.url;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || fallback?.publishableKey;
  if (!url || !key) return null;
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await client.auth.getClaims(jwt);
    return error ? null : ((data?.claims?.sub as string | undefined) ?? null);
  } catch {
    return null;
  }
}

function cookieAccessToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as { access_token?: string };
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

// As rotas /api/internal são chamadas pelo navegador via fetch same-origin:
// os cookies httpOnly viajam sozinhos. Quando a autenticação vier do cookie
// (sem Bearer), exige mesma origem — sem isso, o cookie auto-enviado
// abriria brecha de CSRF.
function isSameOrigin(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = (forwarded ?? request.headers.get("host") ?? "").split(",")[0]?.trim() ?? "";
  if (!host) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export async function authenticatedUserId(request: Request) {
  // 1) Bearer (fluxo atual: o hotspot-client anexa quando tem a sessão em
  //    memória; fallback de preview). Token legível por JS = sem risco de
  //    CSRF por construção.
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const userId = await userIdFromJwt(authorization.slice(7).trim());
    if (userId) return userId;
  }

  // 2) Cookie httpOnly (fluxo padrão) — exige mesma origem.
  //    Sem refresh aqui: se o access token expirou, o client hidrata de
  //    novo (o cookie é renovado pelo middleware das server functions).
  const cookieToken = cookieAccessToken(request);
  if (cookieToken && isSameOrigin(request)) {
    return userIdFromJwt(cookieToken);
  }

  return null;
}

export async function canManageHotspotDevice(userId: string, device: {
  company_id: string;
  branch_id: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roles, error: roleError }, { data: company }, { data: branch }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role,company_id,branch_id,reseller_id").eq("user_id", userId),
    supabaseAdmin.from("companies").select("reseller_id").eq("id", device.company_id).maybeSingle(),
    device.branch_id
      ? supabaseAdmin.from("branches").select("reseller_id").eq("id", device.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (roleError) return false;
  const resellerId = branch?.reseller_id ?? company?.reseller_id ?? null;
  return (roles ?? []).some((role: any) =>
    role.role === "adm" ||
    (role.role === "matriz" && role.company_id === device.company_id) ||
    (role.role === "filial" && device.branch_id && role.branch_id === device.branch_id) ||
    (role.role === "revenda" && resellerId && role.reseller_id === resellerId),
  );
}
