import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { hotspotSyncAckSignature } from "@/lib/hotspot-router-auth";

const headers = { "cache-control": "no-store" };

export const Route = createFileRoute("/api/internal/hotspot-sync-ack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const identity = url.searchParams.get("routerIdentity") ?? "";
        const requestId = url.searchParams.get("requestId") ?? "";
        const signature = url.searchParams.get("signature") ?? "";
        if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity) || !/^\d{13}$/.test(requestId) || !/^[a-f0-9]{64}$/.test(signature)) {
          return new Response("Invalid request", { status: 400, headers });
        }
        const expected = hotspotSyncAckSignature(identity, requestId);
        if (!expected || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return new Response("Unauthorized", { status: 401, headers });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device, error: lookupError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .select("id,sync_requested_at,sync_applied_at")
          .eq("router_identity", identity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500, headers });
        const requestedAt = device?.sync_requested_at;
        if (!requestedAt || String(Date.parse(requestedAt)) !== requestId) {
          return new Response("Stale synchronization", { status: 409, headers });
        }
        if (device.sync_applied_at === requestedAt) return Response.json({ ok: true }, { headers });

        const { data: updated, error: updateError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .update({ sync_applied_at: requestedAt, updated_at: new Date().toISOString() })
          .eq("id", device.id)
          .eq("sync_requested_at", requestedAt)
          .is("sync_applied_at", null)
          .select("id")
          .maybeSingle();
        if (updateError) return new Response("Could not confirm synchronization", { status: 500, headers });
        if (!updated) return new Response("Synchronization changed", { status: 409, headers });

        const { error: auditError } = await (supabaseAdmin as any)
          .from("hotspot_device_audit")
          .insert({
            action: "sync_applied",
            device_id: device.id,
            new_status: "sync_applied",
            created_at: new Date().toISOString(),
          });
        if (auditError) console.error("[hotspot-sync-ack] Could not audit synchronization", auditError);
        return Response.json({ ok: true }, { headers });
      },
    },
  },
});
