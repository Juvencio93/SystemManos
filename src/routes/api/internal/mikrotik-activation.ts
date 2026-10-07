import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { hotspotRouterToken } from "@/lib/hotspot-router-auth";

const baseUrl = "https://manostech-system.com.br";

function radiusMarker(secret: string) {
  return `MANOS-RADIUS-${createHash("sha256").update(secret).digest("hex").slice(0, 16)}-V5`;
}

function authorizedDownload(identity: string, exp: string, kind: string, sig: string, secret: string) {
  if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity) || !/^\d{13}$/.test(exp) || Number(exp) < Date.now() || !["activation", "heartbeat"].includes(kind)) return false;
  const expected = createHmac("sha256", secret).update(`${identity}.${exp}.${kind}`).digest("hex");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

function heartbeatScript(identity: string, token: string) {
  const kitVersion = "2026.10.06.3";
  const scriptSource = `
  :local routerIdentity "${identity}"
  :local heartbeatToken "${token}"
  :local wanIpRaw ""
  :local wanAddressId [/ip address find where interface="bridge-wan" dynamic=yes]
  :if ([:len $wanAddressId] > 0) do={ :set wanIpRaw [/ip address get $wanAddressId address] }
  :local wanIp $wanIpRaw
  :if ([:find $wanIpRaw "/"] != nil) do={ :set wanIp [:pick $wanIpRaw 0 [:find $wanIpRaw "/"]] }
  :local routerVersion [/system resource get version]
  :local uptime [/system resource get uptime]
  :local routerMac ""
  :local ether5Id [/interface ethernet find where name="ether5"]
  :if ([:len $ether5Id] > 0) do={ :set routerMac [/interface ethernet get $ether5Id mac-address] }
  :local sessions [/ip hotspot active print count-only]
  :local rxBytes 0
  :local txBytes 0
  :foreach activeId in=[/ip hotspot active find] do={
    :set rxBytes ($rxBytes + [/ip hotspot active get $activeId bytes-in])
    :set txBytes ($txBytes + [/ip hotspot active get $activeId bytes-out])
  }
  :local pingSent 3
  :local pingReceived 0
  :local latencyMs ""
  :do {
    # RouterOS 7 returns one result per probe for count>1; each successful
    # result carries its RTT as a time value. Aggregate those replies locally.
    :local pingResults [/ping address=1.1.1.1 count=$pingSent as-value proplist=time]
    :local totalRttNanoseconds 0
    :foreach pingResult in=$pingResults do={
      :local roundTripTime ($pingResult->"time")
      :if ([:typeof $roundTripTime] = "time") do={
        :set totalRttNanoseconds ($totalRttNanoseconds + [:tonsec $roundTripTime])
        :set pingReceived ($pingReceived + 1)
      }
    }
    :if ($pingReceived > 0) do={ :set latencyMs ($totalRttNanoseconds / $pingReceived / 1000000) }
  } on-error={ :set pingReceived 0; :set latencyMs "" }
  :local packetLossPct ""
  :if ($pingSent > 0) do={ :set packetLossPct (100 - (($pingReceived * 100) / $pingSent)) }
  :local schedulerId [/system scheduler find where name="MANOS-HEARTBEAT"]
  :local schedulerComment ""
  :if ([:len $schedulerId] > 0) do={ :set schedulerComment [/system scheduler get $schedulerId comment] }
  :local firewallBlocked ""
  :if ([:pick $schedulerComment 0 9] = "MANOS-FW-") do={ :set firewallBlocked [:pick $schedulerComment 9 [:len $schedulerComment]] }
  :local heartbeatScriptId [/system script find where name="MANOS-HEARTBEAT"]
  :local rebootComment ""
  :if ([:len $heartbeatScriptId] > 0) do={ :set rebootComment [/system script get $heartbeatScriptId comment] }
  :local rebootCommandId ""
  :local rebootPrefix "MANOS-REBOOT-"
  :if ([:pick $rebootComment 0 [:len $rebootPrefix]] = $rebootPrefix) do={
    :set rebootCommandId [:pick $rebootComment [:len $rebootPrefix] [:len $rebootComment]]
  }
  # RouterOS can truncate a POST URL assembled with many query parameters.
  # Send telemetry as headers instead, so the heartbeat remains valid even
  # when the installed RouterOS formats version or uptime differently.
  :local heartbeatUrl "${baseUrl}/api/internal/hotspot-heartbeat"
  :local heartbeatHeaders ("X-Manos-Heartbeat: " . $heartbeatToken . ",X-Manos-Router: " . $routerIdentity . ",X-Manos-Mac: " . $routerMac . ",X-Manos-IP: " . $wanIp . ",X-Manos-Version: " . $routerVersion . ",X-Manos-Kit-Version: ${kitVersion}" . ",X-Manos-Uptime: " . $uptime . ",X-Manos-Sessions: " . $sessions . ",X-Manos-RX-Bytes: " . $rxBytes . ",X-Manos-TX-Bytes: " . $txBytes . ",X-Manos-Latency-MS: " . $latencyMs . ",X-Manos-Packet-Loss: " . $packetLossPct . ",X-Manos-Firewall: " . $firewallBlocked . ",X-Manos-Reboot-Command: " . $rebootCommandId)
  :do {
    /tool fetch url=$heartbeatUrl http-method=post http-header-field=$heartbeatHeaders check-certificate=yes keep-result=no
  } on-error={ :log warning "Manos Tech heartbeat failed" }
  :local commandFile "flash/manos-command.rsc"
  :local commandFileId [/file find where name=$commandFile]
  :if ([:len $commandFileId] > 0) do={ /file remove $commandFileId }
  :local commandUrl ("${baseUrl}/api/internal/hotspot-command?routerIdentity=" . $routerIdentity . "&rebootCommandId=" . $rebootCommandId)
  :do {
    :local fetchResult [/tool fetch url=$commandUrl http-header-field=("X-Manos-Heartbeat: " . $heartbeatToken) check-certificate=yes dst-path=$commandFile as-value]
    :if (($fetchResult->"status") = "finished") do={
      :local fetchedFileId [/file find where name=$commandFile]
      :if ([:len $fetchedFileId] > 0) do={ /import file-name=$commandFile }
    }
  } on-error={ :log warning "Manos Tech command fetch/import failed" }
`;
  return `# Personalized Manos Tech heartbeat for RouterOS v7; safe to import again.
:if ([:len [/system script find where name="MANOS-HEARTBEAT"]] = 0) do={
  /system script add name="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source={${scriptSource}}
} else={
  /system script set [find where name="MANOS-HEARTBEAT"] policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon source={${scriptSource}}
}
:if ([:len [/system scheduler find where name="MANOS-HEARTBEAT"]] = 0) do={
  /system scheduler add name="MANOS-HEARTBEAT" interval=5s on-event="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon disabled=no
} else={
  /system scheduler set [find where name="MANOS-HEARTBEAT"] interval=5s on-event="MANOS-HEARTBEAT" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon disabled=no
}
:log info "Manos Tech heartbeat configured (5s)"
`;
}

function activationScript(identity: string, radiusHost: string, radiusSecret: string) {
  return `# Personalized activation for ${identity}; requires MANOS-HOTSPOT-BASE.rsc first.
:local routerIdentity "${identity}"
:local radiusHost "${radiusHost}"
:local radiusSecret "${radiusSecret}"
:if ([:len [/ip hotspot find where name="hotspot1"]] = 0) do={ :error "MANOS base not installed: hotspot1 is missing" }
:if ([:len [/ip hotspot profile find where name="hsprof1"]] = 0) do={ :error "MANOS base not installed: hsprof1 is missing" }
/system identity set name=$routerIdentity
:if ([:len [/radius find where service=hotspot]] = 0) do={
  /radius add service=hotspot address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${radiusMarker(radiusSecret)}"
} else={
  /radius set [find where service=hotspot] address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${radiusMarker(radiusSecret)}"
}
/ip hotspot profile set [find where name="hsprof1"] use-radius=yes radius-accounting=yes login-by=http-chap,http-pap html-directory="/flash/hotspot" html-directory-override=""
/ip hotspot set [find where name="hotspot1"] idle-timeout=none keepalive-timeout=none login-timeout=none disabled=no
:foreach host in={"manostech-system.com.br";"*.manostech-system.com.br";"idzvginmbesnkcaapehh.supabase.co"} do={
  :if ([:len [/ip hotspot walled-garden ip find where dst-host=$host]] = 0) do={ /ip hotspot walled-garden ip add dst-host=$host action=accept comment="MANOS-PORTAL" }
}
:log info "Manos Tech activation complete for $routerIdentity"
`;
}

export const Route = createFileRoute("/api/internal/mikrotik-activation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const identity = url.searchParams.get("router") ?? "";
        const exp = url.searchParams.get("exp") ?? "";
        const sig = url.searchParams.get("sig") ?? "";
        const kind = url.searchParams.get("kind") ?? "activation";
        const credentialSecret = process.env["HOTSPOT_CREDENTIAL_SECRET"]?.trim();
        if (!credentialSecret || !authorizedDownload(identity, exp, kind, sig, credentialSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let script: string;
        if (kind === "heartbeat") {
          const token = hotspotRouterToken(identity);
          if (!token) return new Response("Heartbeat unavailable", { status: 503 });
          script = heartbeatScript(identity, token);
        } else if (kind === "activation") {
          const radiusHost = process.env["MIKROTIK_RADIUS_HOST"]?.trim();
          const radiusSecret = process.env["MIKROTIK_RADIUS_SECRET"]?.trim();
          if (!radiusHost || !/^[A-Za-z0-9.-]{1,253}$/.test(radiusHost) || !radiusSecret || !/^[A-Za-z0-9_-]{16,128}$/.test(radiusSecret)) {
            return new Response("RADIUS activation unavailable", { status: 503 });
          }
          script = activationScript(identity, radiusHost, radiusSecret);
        } else {
          return new Response("Unsupported file kind", { status: 400 });
        }

        return new Response(script, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store, no-cache, must-revalidate",
            "content-disposition": `attachment; filename="${identity}-${kind}.rsc"`,
          },
        });
      },
    },
  },
});
