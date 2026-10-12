import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticatedUserId, canManageHotspotDevice } from "@/lib/hotspot-admin-auth";

const bodySchema = z.object({
  routerIdentity: z.string().trim().regex(/^MT-[A-Z0-9-]{6,48}$/),
  blocked: z.boolean().optional(),
  retireDuplicate: z.boolean().optional(),
}).refine((value) => (value.blocked !== undefined) !== (value.retireDuplicate === true));

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
          .select("id,router_identity,ap_mac,last_seen_at,status,company_id,branch_id")
          .eq("router_identity", parsed.data.routerIdentity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500 });
        if (!device) return new Response("Device not found", { status: 404 });
        if (!(await canManageHotspotDevice(userId, device))) return new Response("Forbidden", { status: 403 });
        if (device.status === "suspended" && !parsed.data.retireDuplicate) {
          return new Response("Suspended device cannot be managed", { status: 409 });
        }

        if (parsed.data.retireDuplicate) {
          const { data: adminRole, error: roleError } = await (supabaseAdmin as any)
            .from("user_roles")
            .select("user_id")
            .eq("user_id", userId)
            .eq("role", "adm")
            .maybeSingle();
          if (roleError) return new Response("Could not verify administrator", { status: 500 });
          if (!adminRole) return new Response("Forbidden", { status: 403 });
          if (!device.ap_mac) return new Response("Device has no MAC address", { status: 409 });

          const { data: peers, error: peersError } = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .select("router_identity,last_seen_at,status")
            .eq("ap_mac", device.ap_mac)
            .neq("router_identity", device.router_identity)
            .neq("status", "suspended");
          if (peersError) return new Response("Could not verify duplicate device", { status: 500 });
          const nowMs = Date.now();
          const hasLiveTwin = (peers ?? []).some((peer: any) => {
            const seenAt = peer.last_seen_at ? Date.parse(peer.last_seen_at) : 0;
            return peer.status === "operational" && Number.isFinite(seenAt) && nowMs - seenAt < 15_000;
          });
          const deviceSeenAt = device.last_seen_at ? Date.parse(device.last_seen_at) : 0;
          const deviceIsOnline = Number.isFinite(deviceSeenAt) && nowMs - deviceSeenAt < 15_000;
          if (!hasLiveTwin || deviceIsOnline) {
            return new Response("Only an offline duplicate of a currently online router can be archived", { status: 409 });
          }

          const now = new Date().toISOString();
          const { error: updateError } = await (supabaseAdmin as any)
            .from("hotspot_devices")
            .update({ status: "suspended", active_sessions: 0, updated_at: now })
            .eq("id", device.id);
          if (updateError) return new Response("Could not archive duplicate device", { status: 500 });
          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: "retire_duplicate_device",
            previous_status: device.status,
            new_status: "suspended",
            device_id: device.id,
            actor_id: userId,
            created_at: now,
          });
          if (auditError) return new Response("Duplicate archived, but audit recording failed", { status: 500 });
          return Response.json({ ok: true, status: "suspended" });
        }

        let nextStatus = "blocked";
        if (parsed.data.blocked === false) {
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
