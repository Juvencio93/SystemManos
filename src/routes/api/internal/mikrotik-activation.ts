import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mikrotik-activation")({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url), identity = url.searchParams.get("router"), exp = url.searchParams.get("exp"), sig = url.searchParams.get("sig");
    const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"];
    if (!identity || !exp || !sig || !secret || Number(exp) < Date.now()) return new Response("Unauthorized", { status: 401 });
    const expected = createHmac("sha256", secret).update(`${identity}.${exp}`).digest("hex");
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return new Response("Unauthorized", { status: 401 });
    const token = process.env["RADIUS_API_TOKEN"];
    if (!token) return new Response("Activation unavailable", { status: 503 });
    const script = `:local routerIdentity "${identity}"\n:local heartbeatToken "${token}"\n:local radiusHost "***REMOVED***"\n:local radiusSecret "***REMOVED***"\n/system identity set name=$routerIdentity\n/radius remove [find service=hotspot]\n/radius add service=hotspot address=$radiusHost secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no\n/ip hotspot profile set [find name="hsprof1"] use-radius=yes radius-accounting=yes login-by=http-chap,http-pap html-directory=flash/hotspot html-directory-override=flash/hotspot\n/ip hotspot enable [find name="hotspot1"]\n/system scheduler add name="MANOS-HEARTBEAT" interval=5m on-event="/tool fetch http-method=post http-header-field=\\"Content-Type: application/json,X-Manos-Heartbeat: $heartbeatToken\\" url=\\"https://manostech-system.com.br/api/internal/hotspot-heartbeat\\" keep-result=no"`;
    return new Response(script, { headers: { "content-type": "text/plain", "content-disposition": `attachment; filename="${identity}-activation.rsc"` } });
  } } },
});
