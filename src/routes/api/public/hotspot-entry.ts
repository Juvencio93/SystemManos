import { createFileRoute } from "@tanstack/react-router";
import { portalSlugForRouterIdentity } from "@/lib/hotspot-device.server";

const safeValue = (value: FormDataEntryValue | string | null, maximum = 2_000) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maximum ? trimmed : null;
};

const safeSlug = (value: FormDataEntryValue | string | null) => {
  const slug = safeValue(value, 120);
  return slug && /^[a-z0-9][a-z0-9-]*$/i.test(slug) ? slug : null;
};

/**
 * Receives the standard external-portal fields posted by a MikroTik login.html
 * and forwards them to the public portal. This route never authenticates a
 * client by itself: the device remains the authority that releases network
 * access after the check-in flow returns to it.
 */
export const Route = createFileRoute("/api/public/hotspot-entry")({
  server: {
    handlers: {
      GET: async ({ request }) => redirectToPortal(request, new URL(request.url).searchParams),
      POST: async ({ request }) => redirectToPortal(request, await request.formData()),
    },
  },
});

async function redirectToPortal(request: Request, input: URLSearchParams | FormData) {
  const get = (name: string) => input.get(name);
  const explicitSlug = safeSlug(get("slug"));
  const routerIdentity = safeValue(get("router-id"), 80);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const slug = explicitSlug ?? await portalSlugForRouterIdentity(supabaseAdmin, routerIdentity);
  if (!slug) {
    return new Response("Portal inválido.", { status: 400 });
  }

  const value = (first: string, second?: string) =>
    safeValue(get(first), 2_000) ?? (second ? safeValue(get(second), 2_000) : null) ?? undefined;
  const { data: handoff, error } = await (supabaseAdmin as any)
    .from("hotspot_portal_handoffs")
    .insert({
      slug,
      router_identity: routerIdentity,
      mac_address: value("mac", "client_mac"),
      ip_address: value("ip", "client_ip"),
      ap_mac: value("ap_mac", "called_station_id"),
      login_only_url: value("link-login-only"),
      origin_url: value("link-orig"),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !handoff) return new Response("Não foi possível iniciar o portal.", { status: 503 });
  const target = new URL(`/portal/${encodeURIComponent(slug)}`, request.url);
  return new Response(null, {
    status: 303,
    headers: {
      location: target.toString(),
      // Keep the short-lived RouterOS handoff out of the address bar. The
      // portal reads this scoped cookie when the visitor submits the form.
      "set-cookie": `manos_hotspot_handoff=${encodeURIComponent(handoff.id)}; Max-Age=600; Path=/portal/${encodeURIComponent(slug)}; SameSite=Lax; Secure`,
      "cache-control": "no-store",
    },
  });
}
