import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-reboot")({
  server: { handlers: { POST: async ({ request }) => {
    const body = await request.json().catch(() => null) as { routerIdentity?: string } | null;
    if (!body?.routerIdentity) return new Response("Invalid", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const requestedAt = new Date().toISOString();
    const { data: device } = await (supabaseAdmin as any).from("hotspot_devices").select("id").eq("router_identity", body.routerIdentity).maybeSingle();
    if (!device?.id) return new Response("Device not found", { status: 404 });
    const { error } = await (supabaseAdmin as any).from("hotspot_devices").update({ reboot_requested_at: requestedAt, reboot_applied_at: null, updated_at: requestedAt }).eq("id", device.id);
    if (error) return new Response("Failed", { status: 500 });
    await (supabaseAdmin as any).from("hotspot_device_audit").insert({ action: "request_reboot", device_id: device.id, new_status: "reboot_requested", created_at: requestedAt });
    return Response.json({ ok: true, requestedAt });
  } } },
});
