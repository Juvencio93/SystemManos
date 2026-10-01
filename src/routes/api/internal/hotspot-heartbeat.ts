import { createFileRoute } from "@tanstack/react-router";
import { heartbeatUpdate, routerUptimeSeconds, sanitizeRouterOsHeartbeat, validateHeartbeat, type HeartbeatInput } from "@/lib/hotspot-protocol";
import { hasHotspotRouterAuth } from "@/lib/hotspot-router-auth";

export const Route = createFileRoute("/api/internal/hotspot-heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const queryBody = Object.fromEntries(new URL(request.url).searchParams);
        const headerIdentity = request.headers.get("x-manos-router");
        const headerMac = request.headers.get("x-manos-mac");
        let body: HeartbeatInput | null;
        if (Object.keys(queryBody).length > 0) body = queryBody as HeartbeatInput;
        else if (headerIdentity) body = {
          routerIdentity: headerIdentity,
          ...(headerMac ? { mac: headerMac } : {}),
          ip: request.headers.get("x-manos-ip") ?? undefined,
          version: request.headers.get("x-manos-version") ?? undefined,
          uptime: request.headers.get("x-manos-uptime") ?? undefined,
          activeSessions: request.headers.get("x-manos-sessions") ?? undefined,
          rxBytes: request.headers.get("x-manos-rx-bytes") ?? undefined,
          txBytes: request.headers.get("x-manos-tx-bytes") ?? undefined,
          latencyMs: request.headers.get("x-manos-latency-ms") ?? undefined,
          packetLossPct: request.headers.get("x-manos-packet-loss") ?? undefined,
          firewallBlocked: request.headers.get("x-manos-firewall") ?? undefined,
          rebootCommandId: request.headers.get("x-manos-reboot-command") ?? undefined,
        };
        else if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
          body = Object.fromEntries(new URLSearchParams(await request.text())) as HeartbeatInput;
        } else body = await request.json().catch(() => null) as HeartbeatInput | null;
        if (!body) return new Response("Invalid heartbeat", { status: 400 });
        const heartbeat = sanitizeRouterOsHeartbeat(body);
        if (!validateHeartbeat(heartbeat)) return new Response("Invalid heartbeat", { status: 400 });
        if (!hasHotspotRouterAuth(request, heartbeat.routerIdentity!)) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: current, error: lookupError } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .select("id,status,router_applied_status,router_status_requested_at,router_status_applied_at,sync_requested_at,sync_applied_at,reboot_requested_at,reboot_applied_at,last_seen_uptime")
          .eq("router_identity", heartbeat.routerIdentity)
          .maybeSingle();
        if (lookupError) return new Response("Could not read device", { status: 500 });
        if (!current) return new Response("Device not found", { status: 404 });
        const now = new Date().toISOString();
        const routerStatusPending = Boolean(current.router_status_requested_at &&
          current.router_status_applied_at !== current.router_status_requested_at);
        const syncPending = Boolean(current.sync_requested_at &&
          current.sync_applied_at !== current.sync_requested_at);
        const previousUptime = routerUptimeSeconds(current.last_seen_uptime ?? undefined);
        const reportedUptime = routerUptimeSeconds(heartbeat.uptime);
        const pendingCommandId = current.reboot_requested_at ? String(Date.parse(current.reboot_requested_at)) : null;
        const rebootConfirmed = Boolean(
          pendingCommandId &&
            body.rebootCommandId === pendingCommandId &&
            current.reboot_applied_at == null &&
            previousUptime !== null &&
            reportedUptime !== null &&
            reportedUptime < previousUptime,
        );
        const reportedFirewallStatus = heartbeat.firewallBlocked === true || heartbeat.firewallBlocked === "yes" ? "blocked" : "unblocked";
        const firewallConfirmed = heartbeat.firewallBlocked !== undefined && heartbeat.firewallBlocked !== "" &&
          (heartbeat.firewallBlocked === true || heartbeat.firewallBlocked === false || heartbeat.firewallBlocked === "yes" || heartbeat.firewallBlocked === "no");
        const firewallMatchesRequest = firewallConfirmed &&
          reportedFirewallStatus === (current.status === "blocked" ? "blocked" : "unblocked");
        const firewallStateChanged = firewallConfirmed && current.router_applied_status !== reportedFirewallStatus;
        const update = {
          ...heartbeatUpdate(heartbeat, now, syncPending ? current.sync_requested_at : null),
          ...(rebootConfirmed ? { reboot_requested_at: null, reboot_applied_at: now } : {}),
          ...(firewallStateChanged ? { router_applied_status: reportedFirewallStatus } : {}),
          ...(routerStatusPending && firewallMatchesRequest ? { router_status_applied_at: now } : {}),
          ...(firewallConfirmed && !firewallMatchesRequest && current.router_status_applied_at
            ? { router_status_applied_at: null }
            : {}),
        };
        const { error } = await (supabaseAdmin as any).from("hotspot_devices").update(update).eq("id", current.id);
        if (error) return new Response("Could not update heartbeat", { status: 500 });
        if (rebootConfirmed) {
          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: "reboot_completed",
            device_id: current.id,
            new_status: "reboot_completed",
            created_at: now,
          });
          if (auditError) console.error("[hotspot-heartbeat] Could not audit completed reboot", auditError);
        }
        if (firewallStateChanged) {
          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: firewallMatchesRequest
              ? reportedFirewallStatus === "blocked" ? "block_applied" : "unblock_applied"
              : "router_status_mismatch",
            device_id: current.id,
            previous_status: current.router_applied_status,
            new_status: reportedFirewallStatus,
            created_at: now,
          });
          if (auditError) console.error("[hotspot-heartbeat] Could not audit applied firewall state", auditError);
        }
        if (syncPending) {
          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: "sync_applied",
            device_id: current.id,
            new_status: "sync_applied",
            created_at: now,
          });
          if (auditError) console.error("[hotspot-heartbeat] Could not audit applied sync", auditError);
        }
        const applied = firewallMatchesRequest ? reportedFirewallStatus : null;
        return Response.json({ ok: true, reboot: rebootConfirmed, firewall: applied });
      },
    },
  },
});
