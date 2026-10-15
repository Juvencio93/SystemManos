import { heartbeatScript } from "@/lib/rb-heartbeat-script.server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { hotspotRouterToken } from "@/lib/hotspot-router-auth";
import baseScript from "../../../../public/mikrotik/MANOS-HOTSPOT-BASE.rsc?raw";

const baseUrl = "https://manostech-system.com.br";

function radiusMarker(secret: string) {
  return `MANOS-RADIUS-${createHash("sha256").update(secret).digest("hex").slice(0, 16)}-V5`;
}

function authorizedDownload(identity: string, exp: string, kind: string, sig: string, secret: string, version: string | null) {
  if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity) || !/^\d{13}$/.test(exp) || Number(exp) < Date.now() || !["setup", "activation", "heartbeat"].includes(kind)) return false;
  const expected = createHmac("sha256", secret).update(`${identity}.${exp}.${kind}${version === null ? "" : `.${version}`}`).digest("hex");
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
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
        const version = url.searchParams.get("assignmentVersion");
        const credentialSecret = process.env["HOTSPOT_CREDENTIAL_SECRET"]?.trim();
        if (!credentialSecret || !authorizedDownload(identity, exp, kind, sig, credentialSecret, version)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device, error } = await (supabaseAdmin as any).from("hotspot_devices").select("assignment_version,credential_version").eq("router_identity",identity).maybeSingle();
        if (error || !device || (version === null ? device.assignment_version !== 0 : String(device.assignment_version) !== version)) return new Response("Download expirado após transferência", { status:409 });
        let script: string;
        if (kind === "setup") {
          const radiusHost = process.env["MIKROTIK_RADIUS_HOST"]?.trim();
          const radiusSecret = process.env["MIKROTIK_RADIUS_SECRET"]?.trim();
          const token = hotspotRouterToken(identity, device.credential_version);
          if (!radiusHost || !/^[A-Za-z0-9.-]{1,253}$/.test(radiusHost) || !radiusSecret || !/^[A-Za-z0-9_-]{16,128}$/.test(radiusSecret) || !token) {
            return new Response("Initial kit unavailable", { status: 503 });
          }
          // The physical port layout is prepared only on first installation.
          // Later assignments arrive through the heartbeat and do not import this kit.
          script = `${baseScript}\n${activationScript(identity, radiusHost, radiusSecret)}\n${heartbeatScript(identity, token)}`;
        } else if (kind === "heartbeat") {
          const token = hotspotRouterToken(identity, device.credential_version);
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
