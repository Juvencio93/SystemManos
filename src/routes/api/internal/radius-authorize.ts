import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { authorizeHotspotAccess } from "@/lib/hotspot-access.server";
import { markRouterHomologated } from "@/lib/hotspot-device.server";

const unauthorized = () => new Response(JSON.stringify({}), {
  status: 401,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

function hasRadiusToken(request: Request, expected: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = `Bearer ${expected}`;
  if (authorization.length === bearer.length && timingSafeEqual(Buffer.from(authorization), Buffer.from(bearer))) {
    return true;
  }

  if (!authorization.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const basic = `radius:${expected}`;
  return decoded.length === basic.length && timingSafeEqual(Buffer.from(decoded), Buffer.from(basic));
}

/**
 * Private FreeRADIUS lookup. The VPS sends an HTTPS request authenticated with
 * RADIUS_API_TOKEN. It returns a FreeRADIUS rlm_rest control attribute only
 * for an unexpired grant bound to the requesting device MAC address.
 */
export const Route = createFileRoute("/api/internal/radius-authorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["RADIUS_API_TOKEN"];
        if (!expected || !hasRadiusToken(request, expected)) {
          return unauthorized();
        }

        const contentType = request.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json")
          ? await request.json().catch(() => ({}))
          : Object.fromEntries(await request.formData());
        const fields = body as Record<string, unknown>;
        const username = typeof fields["User-Name"] === "string" ? fields["User-Name"] : null;
        const mac = typeof fields["Calling-Station-Id"] === "string" ? fields["Calling-Station-Id"] : null;
        const routerIdentity = typeof fields["NAS-Identifier"] === "string" ? fields["NAS-Identifier"] : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (routerIdentity) {
          const { data: device, error: deviceError } = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .select("status")
            .eq("router_identity", routerIdentity)
            .maybeSingle();
          // Do not issue grants to an unknown, removed or blocked router when
          // FreeRADIUS identifies the requesting NAS.
          if (deviceError || !device || device.status === "blocked") return unauthorized();
        }
        const grant = await authorizeHotspotAccess(supabaseAdmin, { username, mac });
        if (!grant) return unauthorized();
        await markRouterHomologated(supabaseAdmin, routerIdentity);

        // RouterOS applies these attributes only to this authenticated HotSpot
        // session. Its rate notation is router-centric: rx is client upload
        // and tx is client download.
        return new Response(
          JSON.stringify({
            "control:Cleartext-Password": grant.password,
            "reply:Session-Timeout": grant.sessionTimeoutSeconds,
            "reply:Idle-Timeout": grant.idleTimeoutSeconds,
            // RouterOS Hotspot uses rx/tx: client upload first, download second.
            "reply:Mikrotik-Rate-Limit": `${grant.uploadKbps}k/${grant.downloadKbps}k`,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
