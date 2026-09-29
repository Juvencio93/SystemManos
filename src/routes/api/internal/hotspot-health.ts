import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-health")({
  server: { handlers: { GET: async () => { const radiusConfigured = Boolean(process.env["RADIUS_API_TOKEN"]); const heartbeatConfigured = Boolean(process.env["HOTSPOT_CREDENTIAL_SECRET"]); return Response.json({ ok: radiusConfigured && heartbeatConfigured, radiusConfigured, heartbeatConfigured, reason: !radiusConfigured ? "Token RADIUS ausente" : !heartbeatConfigured ? "Segredo de heartbeat ausente" : "Configuração do servidor válida", checkedAt: new Date().toISOString() }); } } },
});
