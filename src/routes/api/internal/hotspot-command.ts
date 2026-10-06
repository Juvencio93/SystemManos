import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { hasHotspotRouterAuth, hotspotSyncAckSignature } from "@/lib/hotspot-router-auth";

const headers = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate" };
const noOp = () => new Response("# no-op\n", { headers });

const BLOCK_RULES = [
  ["MANOS-BLOCK-HOTSPOT-FORWARD", "forward", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-FORWARD", "forward", "192.168.89.0/24"],
  ["MANOS-BLOCK-HOTSPOT-INPUT", "input", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-INPUT", "input", "192.168.89.0/24"],
] as const;

function firewallStateScript() {
  const tests = BLOCK_RULES.map(([comment]) => `:if ([:len [/ip firewall filter find where comment="${comment}" disabled=no]] > 0) do={ :set blockedRuleCount ($blockedRuleCount + 1) }`).join("\n");
  return `:local blockedRuleCount 0\n${tests}\n:local firewallState "no"\n:if ($blockedRuleCount = 4) do={ :set firewallState "yes" }\n:local expectedComment ("MANOS-FW-" . $firewallState)\n:local schedulerId [/system scheduler find where name="MANOS-HEARTBEAT"]\n:if ([:len $schedulerId] > 0 && [/system scheduler get $schedulerId comment] != $expectedComment) do={ /system scheduler set $schedulerId comment=$expectedComment }\n`;
}

function statusCommand(blocked: boolean) {
  const removeManagedRule = (comment: string) => `:if ([:len [/ip firewall filter find where comment="${comment}"]] > 0) do={ /ip firewall filter remove [find where comment="${comment}"] }`;
  if (!blocked) {
    return `${BLOCK_RULES.map(([comment]) => removeManagedRule(comment)).join("\n")}\n${removeManagedRule("MANOS-BLOCK-ETHER5")}\n`;
  }
  return `# Quarantine all RB-routed networks. ether5 remains a transparent provider-LAN bridge.
${removeManagedRule("MANOS-BLOCK-ETHER5")}
${BLOCK_RULES.map(([comment, chain, subnet]) => `:if ([:len [/ip firewall filter find where comment="${comment}"]] = 0) do={/ip firewall filter add chain=${chain} src-address=${subnet} action=drop place-before=0 comment="${comment}"} else={/ip firewall filter set [find where comment="${comment}"] disabled=no; /ip firewall filter move [find where comment="${comment}"] destination=0}`).join("\n")}
`;
}

function hotspotLoginFileSyncCommand() {
  // Upgrade the on-router login page once. This keeps the credentials POST
  // same-origin with RouterOS and retries on later heartbeats if a fetch fails.
  return `:if ([:len [/file find where name="flash/manos-login-v3.marker"]] = 0) do={
  :do {
    :local manosLoginFetch [/tool fetch url="https://manostech-system.com.br/mikrotik/login.html" mode=https dst-path="flash/hotspot/login.html" check-certificate=yes as-value]
    :if (($manosLoginFetch->"status") = "finished") do={
      /tool fetch url="https://manostech-system.com.br/mikrotik/manos-login-v3.marker" mode=https dst-path="flash/manos-login-v3.marker" check-certificate=yes
    }
  } on-error={ :log warning "Manos Tech login page update failed; will retry" }
}
`;
}

function syncAcknowledgementCommand(identity: string, requestedAt: string, blocked: boolean) {
  const requestId = String(Date.parse(requestedAt));
  if (!/^\d{13}$/.test(requestId)) return "";
  const signature = hotspotSyncAckSignature(identity, requestId);
  if (!signature) return "";
  const firewallState = blocked ? "yes" : "no";
  const url = `https://manostech-system.com.br/api/internal/hotspot-sync-ack?routerIdentity=${identity}&requestId=${requestId}&signature=${signature}`;
  // These checks run after the commands above. An import or fetch failure
  // leaves the request pending instead of reporting a false success.
  return `:if ([:len [/radius find where service=hotspot comment~"^MANOS-RADIUS" disabled=no]] = 0) do={ :error "Manos Tech RADIUS sync not confirmed" }
:if ([:len [/file find where name="flash/manos-login-v3.marker"]] = 0) do={ :error "Manos Tech login sync not confirmed" }
:if ([:len [/system scheduler find where name="MANOS-HEARTBEAT" comment="MANOS-FW-${firewallState}"]] = 0) do={ :error "Manos Tech firewall sync not confirmed" }
/tool fetch url="${url}" http-method=post http-data="" output=none check-certificate=yes
`;
}

/**
 * A router that is already proving its identity through the heartbeat can
 * safely receive the current RADIUS credential over that TLS channel. The
 * marker makes credential rotations idempotent. The same heartbeat also
 * repairs an accidentally disabled RADIUS entry, which otherwise silently
 * prevents HotSpot logins even when the shared secret is correct.
 */
function radiusCredentialCommand() {
  const host = process.env["MIKROTIK_RADIUS_HOST"]?.trim();
  const secret = process.env["MIKROTIK_RADIUS_SECRET"]?.trim();
  if (!host || !/^[A-Za-z0-9.-]{1,253}$/.test(host) || !secret || !/^[A-Za-z0-9_-]{16,128}$/.test(secret)) return "";
  // Keep the managed RouterOS entry in sync with the canonical server values.
  const marker = `MANOS-RADIUS-${createHash("sha256").update(secret).digest("hex").slice(0, 16)}-V4`;
  // The comment is only a version marker; it cannot prove the router's hidden
  // secret field still matches. Re-apply every managed setting on heartbeat,
  // and only touch entries owned by Manos Tech (never unrelated RADIUS peers).
  return `:local manosRadiusId [/radius find where service=hotspot comment~"^MANOS-RADIUS"]
:if ([:len $manosRadiusId] = 0) do={
  /radius add service=hotspot address="${host}" secret="${secret}" authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${marker}"
} else={
  /radius set $manosRadiusId service=hotspot address="${host}" secret="${secret}" authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${marker}"
}
`;
}

export const Route = createFileRoute("/api/internal/hotspot-command")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const identity = url.searchParams.get("routerIdentity") ?? "";
        const commandIdFromRouter = url.searchParams.get("rebootCommandId") ?? "";
        if (!identity || !hasHotspotRouterAuth(request, identity)) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device, error } = await (supabaseAdmin as any)
          .from("hotspot_devices")
          .select("id,status,router_applied_status,reboot_requested_at,router_status_requested_at,router_status_applied_at,sync_requested_at,sync_applied_at")
          .eq("router_identity", identity)
          .maybeSingle();
        if (error) return new Response("Could not read device", { status: 500 });
        if (!device) return noOp();

        if (device.reboot_requested_at) {
          const expectedCommandId = String(Date.parse(device.reboot_requested_at));

          // A marker proves that a command was received, but not that RouterOS
          // actually rebooted. The old flow stopped forever after writing the
          // marker when the reboot itself failed. Retry at a controlled pace
          // until a post-boot heartbeat confirms the restart.
          const { data: lastDispatch } = await (supabaseAdmin as any)
            .from("hotspot_device_audit")
            .select("created_at")
            .eq("device_id", device.id)
            .eq("action", "reboot_dispatched")
            .gte("created_at", device.reboot_requested_at)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (
            lastDispatch?.created_at &&
            Date.now() - Date.parse(lastDispatch.created_at) < 30_000
          ) {
            return noOp();
          }

          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: "reboot_dispatched",
            device_id: device.id,
            new_status: "reboot_dispatched",
            created_at: new Date().toISOString(),
          });
          if (auditError) return new Response("Could not audit reboot dispatch", { status: 500 });

          // Run the reboot outside the imported command file. This lets the
          // import finish cleanly before RouterOS terminates the current job.
          const command = `/system script set [find where name="MANOS-HEARTBEAT"] comment="MANOS-REBOOT-${expectedCommandId}"\n:execute {:delay 2s; /system reboot}\n`;
          return new Response(command, { headers });
        }

        if (commandIdFromRouter) {
          return new Response('/system script set [find where name="MANOS-HEARTBEAT"] comment=""\n', { headers });
        }

        const radiusCommand = radiusCredentialCommand();
        const syncPending = Boolean(device.sync_requested_at && device.sync_applied_at !== device.sync_requested_at);
        const statusPending = Boolean(device.router_status_requested_at && device.router_status_applied_at !== device.router_status_requested_at);
        const blocked = device.status === "blocked";
        const confirmation = syncPending && radiusCommand
          ? syncAcknowledgementCommand(identity, device.sync_requested_at, blocked)
          : "";
        const reportedStatusMismatch = device.router_applied_status !== (blocked ? "blocked" : "unblocked");
        const firewallCheck = statusPending || confirmation || reportedStatusMismatch ? `\n${firewallStateScript()}` : "";
        return new Response(
          `${radiusCommand}${hotspotLoginFileSyncCommand()}${statusCommand(blocked)}${firewallCheck}${confirmation}`,
          { headers },
        );
      },
    },
  },
});
