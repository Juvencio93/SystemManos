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
    const script = kind === "heartbeat" ? `:local heartbeatToken "${token}"
 :local routerIdentity [/system identity get name]
 :local heartbeatUrl "https://manostech-system.com.br/api/internal/hotspot-heartbeat?routerIdentity=$routerIdentity"
 /tool fetch url=$heartbeatUrl http-method=post http-header-field=("X-Manos-Heartbeat: " . $heartbeatToken) keep-result=no
` : `:local routerIdentity "${identity}"
 :local radiusHost "***REMOVED***"
:local radiusSecret "***REMOVED***"
/system identity set name=$routerIdentity
/radius remove [find service=hotspot]
/radius add service=hotspot address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no
/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes login-by=http-chap,http-pap html-directory=flash/hotspot html-directory-override=flash/hotspot
 /ip hotspot enable [find name="hotspot1"]
 `;
    return new Response(script, { headers: { "content-type": "text/plain", "content-disposition": `attachment; filename="${identity}-${kind}.rsc"` } });
  } } },
});
