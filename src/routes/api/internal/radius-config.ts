import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function authorized(request: Request, expected: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = `Bearer ${expected}`;
  if (authorization.length === bearer.length && timingSafeEqual(Buffer.from(authorization), Buffer.from(bearer))) return true;
  if (!authorization.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const basic = `radius:${expected}`;
  return decoded.length === basic.length && timingSafeEqual(Buffer.from(decoded), Buffer.from(basic));
}

/** Private credential sync endpoint for the FreeRADIUS VPS; never callable by RBs. */
export const Route = createFileRoute("/api/internal/radius-config")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiToken = process.env["RADIUS_API_TOKEN"]?.trim();
        const radiusHost = process.env["MIKROTIK_RADIUS_HOST"]?.trim();
        const radiusSecret = process.env["MIKROTIK_RADIUS_SECRET"]?.trim();
        if (!apiToken || !authorized(request, apiToken)) return new Response("Unauthorized", { status: 401 });
        if (!radiusHost || !radiusSecret) return new Response("RADIUS unavailable", { status: 503 });
        return Response.json({ radiusHost, radiusSecret }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
