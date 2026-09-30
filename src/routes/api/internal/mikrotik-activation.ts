import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mikrotik-activation")({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url), identity = url.searchParams.get("router"), exp = url.searchParams.get("exp"), sig = url.searchParams.get("sig"), kind = url.searchParams.get("kind") ?? "activation";
    const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"];
    if (!identity || !exp || !sig || !secret || Number(exp) < Date.now()) return new Response("Unauthorized", { status: 401 });
    const expected = createHmac("sha256", secret).update(`${identity}.${exp}`).digest("hex");
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return new Response("Unauthorized", { status: 401 });
    const token = process.env["RADIUS_API_TOKEN"];
    if (!token) return new Response("Activation unavailable", { status: 503 });
    const script = kind === "heartbeat" ? `/system scheduler remove [find name="MANOS-HEARTBEAT"]
 /system scheduler add name="MANOS-HEARTBEAT" interval=1m disabled=no on-event={
  :local heartbeatToken "${token}"
  :local routerIdentity [/system identity get name]
  :local wanIpRaw [/ip address get [find interface="ether1" dynamic=yes] address]
  :local wanIp $wanIpRaw
  :if ([:find $wanIpRaw "/"] != nil) do={:set wanIp [:pick $wanIpRaw 0 [:find $wanIpRaw "/"]]}
  :local routerVersion [/system resource get version]
  :local routerMac [/interface ethernet get [find name="ether5"] mac-address]
  :local sessions [/ip hotspot active print count-only]
  :local rxBytes 0
  :local txBytes 0
  :foreach activeId in=[/ip hotspot active find] do={
    :set rxBytes ($rxBytes + [/ip hotspot active get $activeId bytes-in])
    :set txBytes ($txBytes + [/ip hotspot active get $activeId bytes-out])
  }
  :local heartbeatUrl ("https://manostech-system.com.br/api/internal/hotspot-heartbeat?routerIdentity=" . $routerIdentity . "&ip=" . $wanIp . "&version=" . $routerVersion . "&mac=" . $routerMac . "&activeSessions=" . $sessions . "&rxBytes=" . $rxBytes . "&txBytes=" . $txBytes)
  :local heartbeatResult [/tool fetch url=$heartbeatUrl http-method=post http-header-field=("X-Manos-Heartbeat: " . $heartbeatToken) output=user as-value]
  :if ([:find ($heartbeatResult->"data") "\"reboot\":true"] != nil) do={/system reboot}
 }
 /system scheduler enable [find name="MANOS-HEARTBEAT"]
` : `:local routerIdentity "${identity}"
 :local radiusHost "***REMOVED***"
 :local radiusSecret "***REMOVED***"
 :if ([:len [/interface bridge port find bridge="bridge-lan" interface="ether5"]] > 0) do={/interface bridge port remove [find bridge="bridge-lan" interface="ether5"]}
 :if ([:len [/interface bridge find name="bridge-livre"]] = 0) do={/interface bridge add name=bridge-livre protocol-mode=rstp}
 :if ([:len [/interface bridge port find bridge="bridge-livre" interface="ether5"]] = 0) do={/interface bridge port add bridge=bridge-livre interface=ether5}
 :if ([:len [/ip address find address="192.168.89.1/24"]] = 0) do={/ip address add address=192.168.89.1/24 interface=bridge-livre}
 :if ([:len [/ip pool find name="pool-livre"]] = 0) do={/ip pool add name=pool-livre ranges=192.168.89.10-192.168.89.254}
 :if ([:len [/ip dhcp-server find name="dhcp-livre"]] = 0) do={/ip dhcp-server add name=dhcp-livre interface=bridge-livre address-pool=pool-livre lease-time=1h disabled=no}
 :if ([:len [/ip dhcp-server network find address="192.168.89.0/24"]] = 0) do={/ip dhcp-server network add address=192.168.89.0/24 gateway=192.168.89.1 dns-server=192.168.89.1}
 :if ([:len [/ip firewall nat find comment="MANOS-NAT-ETHER5-LIVRE"]] = 0) do={/ip firewall nat add chain=srcnat src-address=192.168.89.0/24 out-interface=ether1 action=masquerade comment="MANOS-NAT-ETHER5-LIVRE"}
/system identity set name=$routerIdentity
/radius remove [find service=hotspot]
/radius add service=hotspot address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no
 /ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes login-by=http-pap html-directory=flash/hotspot html-directory-override=flash/hotspot
 /ip hotspot walled-garden ip add dst-host="manostech-system.com.br" action=accept
 /ip hotspot walled-garden ip add dst-host="*.manostech-system.com.br" action=accept
 /ip hotspot walled-garden ip add dst-host="idzvginmbesnkcaapehh.supabase.co" action=accept
 /ip hotspot enable [find name="hotspot1"]
 `;
    return new Response(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "content-disposition": `attachment; filename="${identity}-${kind}.rsc"` } });
  } } },
});
