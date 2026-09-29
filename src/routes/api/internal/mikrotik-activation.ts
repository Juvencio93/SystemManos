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
    const script = `:local routerIdentity "${identity}"\n:local heartbeatToken "${token}"\n/system identity set name=$routerIdentity\n# Import Hotspot base and configure the heartbeat scheduler for this RB.`;
    return new Response(script, { headers: { "content-type": "text/plain", "content-disposition": `attachment; filename="${identity}-activation.rsc"` } });
  } } },
});
