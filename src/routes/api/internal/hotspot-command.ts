import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-command")({
  server: { handlers: { GET: async ({ request }) => {
    const expected = process.env["RADIUS_API_TOKEN"]?.trim();
    if (!expected || request.headers.get("x-manos-heartbeat") !== expected) return new Response("Unauthorized", { status: 401 });
    const identity = new URL(request.url).searchParams.get("routerIdentity");
    if (!identity) return new Response("# no-op", { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: device } = await (supabaseAdmin as any).from("hotspot_devices").select("id,reboot_requested_at").eq("router_identity", identity).maybeSingle();
    if (!device?.reboot_requested_at) return new Response("# no-op", { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
    await (supabaseAdmin as any).from("hotspot_devices").update({ reboot_requested_at: null, reboot_applied_at: now, updated_at: now }).eq("id", device.id);
    await (supabaseAdmin as any).from("hotspot_device_audit").insert({ action: "reboot_dispatched", device_id: device.id, new_status: "reboot_dispatched", created_at: now });
    return new Response("/system reboot\n", { headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  } } },
});
