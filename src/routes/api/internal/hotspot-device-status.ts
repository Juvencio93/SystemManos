import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticatedUserId, canManageHotspotDevice } from "@/lib/hotspot-admin-auth";

const bodySchema = z.object({ routerIdentity: z.string().trim().regex(/^MT-[A-Z0-9-]{6,48}$/), blocked: z.boolean() });

export const Route = createFileRoute("/api/internal/hotspot-device-status")({
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
          .select("id,router_identity,status,company_id,branch_id")
          .eq("router_identity", parsed.data.routerIdentity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500 });
        if (!device) return new Response("Device not found", { status: 404 });
        if (!(await canManageHotspotDevice(userId, device))) return new Response("Forbidden", { status: 403 });

        let nextStatus = "blocked";
        if (!parsed.data.blocked) {
          let configQuery = (supabaseAdmin as any)
            .from("hotspot_configs")
            .select("status,is_active")
            .eq("company_id", device.company_id);
          configQuery = device.branch_id ? configQuery.eq("branch_id", device.branch_id) : configQuery.is("branch_id", null);
          const { data: config, error: configError } = await configQuery.maybeSingle();
          if (configError) return new Response("Could not read device policy", { status: 500 });
          nextStatus = config?.status === "operational" && config.is_active ? "operational" : "awaiting_homologation";
        }
        const previousStatus = device.status;
        const now = new Date().toISOString();
        const { error: updateError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .update({ status: nextStatus, router_status_requested_at: now, router_status_applied_at: null, updated_at: now })
          .eq("id", device.id);
        if (updateError) return new Response("Could not update device", { status: 500 });

        const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
          action: parsed.data.blocked ? "block_device" : "unblock_device",
          previous_status: previousStatus,
          new_status: nextStatus,
          device_id: device.id,
          actor_id: userId,
          created_at: now,
        });
        if (auditError) return new Response("Device changed, but audit recording failed", { status: 500 });
        return Response.json({ ok: true, status: nextStatus });
      },
    },
  },
});
