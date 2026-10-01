import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticatedUserId, canManageHotspotDevice } from "@/lib/hotspot-admin-auth";

const bodySchema = z.object({ routerIdentity: z.string().trim().regex(/^MT-[A-Z0-9-]{6,48}$/) });

export const Route = createFileRoute("/api/internal/hotspot-sync")({
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
          .select("id,company_id,branch_id")
          .eq("router_identity", parsed.data.routerIdentity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500 });
        if (!device) return new Response("Device not found", { status: 404 });
        if (!(await canManageHotspotDevice(userId, device))) return new Response("Forbidden", { status: 403 });

        const requestedAt = new Date().toISOString();
        const { error: updateError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .update({ sync_requested_at: requestedAt, updated_at: requestedAt })
          .eq("id", device.id);
        if (updateError) return new Response("Could not request sync", { status: 500 });
        const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
          action: "request_sync",
          device_id: device.id,
          new_status: "sync_requested",
          actor_id: userId,
          created_at: requestedAt,
        });
        if (auditError) return new Response("Sync queued, but audit recording failed", { status: 500 });
        return Response.json({ ok: true, requestedAt });
      },
    },
  },
});
