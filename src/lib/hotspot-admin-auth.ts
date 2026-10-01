import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLIC_FALLBACK } from "@/integrations/supabase/public-config";
import type { Database } from "@/integrations/supabase/types";

export async function authenticatedUserId(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const jwt = authorization.slice(7).trim();
  if (!jwt || jwt.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"] || SUPABASE_PUBLIC_FALLBACK.url;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || SUPABASE_PUBLIC_FALLBACK.publishableKey;
  if (!url || !key) return null;
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await client.auth.getClaims(jwt);
    return error ? null : data?.claims?.sub ?? null;
  } catch {
    return null;
  }
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
