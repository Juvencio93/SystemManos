import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticatedUserId, canManageHotspotDevice } from "@/lib/hotspot-admin-auth";

const bodySchema = z.object({ routerIdentity: z.string().trim().regex(/^MT-[A-Z0-9-]{6,48}$/) });

export const Route = createFileRoute("/api/internal/hotspot-reboot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device, error: lookupError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .select("id,router_identity,status,company_id,branch_id,last_seen_at,reboot_requested_at")
          .eq("router_identity", parsed.data.routerIdentity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500 });
        if (!device) return new Response("Device not found", { status: 404 });
        if (!(await canManageHotspotDevice(userId, device))) return new Response("Forbidden", { status: 403 });
        if (!device.last_seen_at || Date.now() - new Date(device.last_seen_at).getTime() > 90_000) {
          return new Response("Router is not online; reboot was not queued", { status: 409 });
        }
        if (device.reboot_requested_at) return new Response("A reboot is already pending", { status: 409 });

        const requestedAt = new Date().toISOString();
        const { data: queued, error: updateError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .update({ reboot_requested_at: requestedAt, reboot_applied_at: null, updated_at: requestedAt })
          .eq("id", device.id)
          .is("reboot_requested_at", null)
          .select("id")
          .maybeSingle();
        if (updateError) return new Response("Could not queue reboot", { status: 500 });
        if (!queued) return new Response("A reboot is already pending", { status: 409 });

        const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
          action: "request_reboot",
          device_id: device.id,
          previous_status: device.status,
          new_status: "reboot_requested",
          actor_id: userId,
          created_at: requestedAt,
        });
        if (auditError) return new Response("Reboot queued, but audit recording failed", { status: 500 });
        return Response.json({ ok: true, requestedAt });
      },
    },
  },
});
