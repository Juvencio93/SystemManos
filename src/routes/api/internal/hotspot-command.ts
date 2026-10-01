import { createFileRoute } from "@tanstack/react-router";
import { hasHotspotRouterAuth } from "@/lib/hotspot-router-auth";

const headers = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate" };
const noOp = () => new Response("# no-op\n", { headers });

const BLOCK_RULES = [
  ["MANOS-BLOCK-HOTSPOT-FORWARD", "forward", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-FORWARD", "forward", "192.168.89.0/24"],
  ["MANOS-BLOCK-HOTSPOT-INPUT", "input", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-INPUT", "input", "192.168.89.0/24"],
] as const;

function firewallStateScript() {
  const tests = BLOCK_RULES.map(([comment]) => `:if ([:len [/ip firewall filter find where comment="${comment}" disabled=no]] = 0) do={ :set blockedRuleCount ($blockedRuleCount + 1) }`).join("\n");
  return `:local blockedRuleCount 0\n${tests}\n:local firewallState "no"\n:if ($blockedRuleCount = 4) do={ :set firewallState "yes" }\n/system scheduler set [find where name="MANOS-HEARTBEAT"] comment=("MANOS-FW-" . $firewallState)\n`;
}

function statusCommand(blocked: boolean) {
  if (!blocked) {
    return `${BLOCK_RULES.map(([comment]) => `/ip firewall filter remove [find where comment="${comment}"]`).join("\n")}\n/ip firewall filter remove [find where comment="MANOS-BLOCK-ETHER5"]\n`;
  }
  return `# Quarantine all RB-routed networks. ether5 remains a transparent provider-LAN bridge.
/ip firewall filter remove [find where comment="MANOS-BLOCK-ETHER5"]
${BLOCK_RULES.map(([comment, chain, subnet]) => `:if ([:len [/ip firewall filter find where comment="${comment}"]] = 0) do={/ip firewall filter add chain=${chain} src-address=${subnet} action=drop place-before=0 comment="${comment}"} else={/ip firewall filter set [find where comment="${comment}"] disabled=no; /ip firewall filter move [find where comment="${comment}"] destination=0}`).join("\n")}
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
          .select("id,status,reboot_requested_at,router_status_requested_at,router_status_applied_at")
          .eq("router_identity", identity)
          .maybeSingle();
        if (error) return new Response("Could not read device", { status: 500 });
        if (!device) return noOp();

        if (device.reboot_requested_at) {
          const expectedCommandId = String(Date.parse(device.reboot_requested_at));
          // The router persists this marker in the heartbeat scheduler before
          // rebooting; do not dispatch a second reboot while it is reconnecting.
          if (commandIdFromRouter === expectedCommandId) return noOp();

          const { error: auditError } = await (supabaseAdmin as any).from("hotspot_device_audit").insert({
            action: "reboot_dispatched",
            device_id: device.id,
            new_status: "reboot_dispatched",
            created_at: new Date().toISOString(),
          });
          if (auditError) return new Response("Could not audit reboot dispatch", { status: 500 });

          const command = `/system script set [find where name="MANOS-HEARTBEAT"] comment="MANOS-REBOOT-${expectedCommandId}"\n/system reboot\n`;
          return new Response(command, { headers });
        }

        if (commandIdFromRouter) {
          return new Response('/system script set [find where name="MANOS-HEARTBEAT"] comment=""\n', { headers });
        }

        if (device.router_status_requested_at && device.router_status_applied_at !== device.router_status_requested_at) {
          return new Response(`${statusCommand(device.status === "blocked")}\n${firewallStateScript()}`, { headers });
        }
        return new Response(statusCommand(device.status === "blocked"), { headers });
      },
    },
  },
});
