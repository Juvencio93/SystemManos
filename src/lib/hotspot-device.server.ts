import { assignmentAllowsAccess } from "./rb-inventory";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const identityPattern = /^MT-[A-Z0-9-]{6,48}$/;

export function normalizeRouterIdentity(value: string | null | undefined) {
  const identity = value?.trim().toUpperCase() ?? "";
  return identityPattern.test(identity) ? identity : null;
}

/** Resolves a generic RouterOS login.html to the configured portal slug. */
export async function portalSlugForRouterIdentity(admin: AdminClient, rawIdentity: string | null | undefined) {
  const identity = normalizeRouterIdentity(rawIdentity);
  if (!identity) return null;

  const { data: device, error } = await (admin as any)
    .from("hotspot_devices")
    .select("*")
    .eq("router_identity", identity)
    .maybeSingle();
  if (error || !device || !assignmentAllowsAccess(device)) return null;

  // Public portal requests never count as an authenticated router heartbeat.

  if (device.branch_id) {
    const { data: branch } = await admin
      .from("branches")
      .select("portal_slug")
      .eq("id", device.branch_id)
      .maybeSingle();
    return branch?.portal_slug ?? null;
  }

  const { data: company } = await admin
    .from("companies")
    .select("portal_slug")
    .eq("id", device.company_id)
    .maybeSingle();
  return company?.portal_slug ?? null;
}

