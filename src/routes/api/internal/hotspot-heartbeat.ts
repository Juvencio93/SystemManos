import { createFileRoute } from "@tanstack/react-router";
import { heartbeatUpdate, validateHeartbeat } from "@/lib/hotspot-protocol";

export const Route = createFileRoute("/api/internal/hotspot-heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["RADIUS_API_TOKEN"]?.trim();
        if (!expected || request.headers.get("x-manos-heartbeat") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")
          ? Object.fromEntries(new URLSearchParams(await request.text())) as Record<string, string>
          : await request.json().catch(() => null) as Record<string, string> | null;
        if (!validateHeartbeat(body)) return new Response("Invalid heartbeat", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: current } = await (supabaseAdmin as any).from("hotspot_devices").select("sync_requested_at").eq("router_identity", body.routerIdentity).maybeSingle();
        const now = new Date().toISOString();
        const { error } = await (supabaseAdmin as any).from("hotspot_devices").update(heartbeatUpdate(body, now, Boolean(current?.sync_requested_at))).eq("router_identity", body.routerIdentity);
        if (error) return new Response("Could not update heartbeat", { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
