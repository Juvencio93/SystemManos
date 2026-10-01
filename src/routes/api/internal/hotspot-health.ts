import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/hotspot-health")({
  server: { handlers: { GET: async () => {
    const radiusApiConfigured = Boolean(process.env["RADIUS_API_TOKEN"]?.trim());
    const radiusDeviceConfigured = Boolean(process.env["MIKROTIK_RADIUS_HOST"]?.trim() && process.env["MIKROTIK_RADIUS_SECRET"]?.trim());
    const heartbeatConfigured = Boolean((process.env["HOTSPOT_CREDENTIAL_SECRET"]?.trim().length ?? 0) >= 32);
    const legacyHeartbeatConfigured = Boolean(process.env["HOTSPOT_LEGACY_HEARTBEAT_TOKEN"]?.trim());
    const ok = radiusApiConfigured && radiusDeviceConfigured && heartbeatConfigured;
    const reason = !radiusApiConfigured ? "Autenticação da API RADIUS ausente" : !radiusDeviceConfigured ? "Credencial RADIUS das RBs ausente" : !heartbeatConfigured ? "Segredo de heartbeat ausente ou curto" : "Configuração do servidor válida";
    return Response.json({ ok, radiusApiConfigured, radiusDeviceConfigured, heartbeatConfigured, legacyHeartbeatConfigured, reason, checkedAt: new Date().toISOString() });
  } } },
});
