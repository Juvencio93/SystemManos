import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["RADIUS_API_TOKEN"]?.trim();
        if (!expected || request.headers.get("x-manos-heartbeat") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = await request.json().catch(() => null) as Record<string, string> | null;
        if (!body?.routerIdentity || !body.mac) return new Response("Invalid heartbeat", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (supabaseAdmin as any).from("hotspot_devices").update({
          ap_mac: body.mac,
          last_seen_at: new Date().toISOString(),
          last_seen_ip: body.ip ?? null,
          router_version: body.version ?? null,
          updated_at: new Date().toISOString(),
        }).eq("router_identity", body.routerIdentity);
        if (error) return new Response("Could not update heartbeat", { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
