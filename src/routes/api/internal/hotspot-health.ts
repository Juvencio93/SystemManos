import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-health")({
  server: { handlers: { GET: async () => Response.json({ ok: true, radiusConfigured: Boolean(process.env["RADIUS_API_TOKEN"]), heartbeatConfigured: Boolean(process.env["HOTSPOT_CREDENTIAL_SECRET"]), checkedAt: new Date().toISOString() }) } },
});
