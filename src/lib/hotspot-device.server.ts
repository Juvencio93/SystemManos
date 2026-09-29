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
    .select("id, hotspot_config_id, company_id, branch_id, status")
    .eq("router_identity", identity)
    .maybeSingle();
  if (error || !device || device.status !== "operational") return null;

  await (admin as any)
    .from("hotspot_devices")
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("router_identity", identity);

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

/** Called only after a valid short-lived RADIUS grant was found. */
export async function markRouterHomologated(admin: AdminClient, rawIdentity: string | null | undefined) {
  const identity = normalizeRouterIdentity(rawIdentity);
  if (!identity) return;
  const now = new Date().toISOString();
  await (admin as any)
    .from("hotspot_devices")
    .update({
      status: "operational",
      last_seen_at: now,
      last_homologated_at: now,
      last_homologation_result: { radius: "accepted" },
      updated_at: now,
    })
    .eq("router_identity", identity);

  // The dialog displays the configuration status, while the portal uses the
  // device status. Keep both records in sync after a real RADIUS acceptance.
  const { data: linkedDevice } = await (admin as any)
    .from("hotspot_devices")
    .select("hotspot_config_id")
    .eq("router_identity", identity)
    .maybeSingle();
  if (linkedDevice?.hotspot_config_id) {
    await (admin as any)
      .from("hotspot_configs")
      .update({ status: "operational", is_active: true, updated_at: now })
      .eq("id", linkedDevice.hotspot_config_id);
  }
}
