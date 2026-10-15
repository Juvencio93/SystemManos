import { createHmac, timingSafeEqual } from "node:crypto";

const HEARTBEAT_HEADER = "x-manos-heartbeat";

function credentialSecret() {
  const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"]?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

/** Derives a distinct RouterOS credential; the FreeRADIUS API token is never sent to a RB. */
export function hotspotRouterToken(routerIdentity: string, version = 0) {
  const secret = credentialSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(version === 0 ? `mikrotik-heartbeat:${routerIdentity}` : `mikrotik-heartbeat:${routerIdentity}:v${version}`).digest("hex");
}

/** Short-lived proof tied to one synchronization request, never a reusable RB token. */
export function hotspotSyncAckSignature(routerIdentity: string, requestId: string) {
  const secret = credentialSecret();
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(`mikrotik-sync:${routerIdentity}:${requestId}`)
    .digest("hex");
}

export function hasHotspotRouterAuth(request: Request, routerIdentity: string) {
  const expected = hotspotRouterToken(routerIdentity);
  const provided = request.headers.get(HEARTBEAT_HEADER) ?? "";
  const acceptedTokens = [expected, process.env["HOTSPOT_LEGACY_HEARTBEAT_TOKEN"]?.trim()].filter(
    (token): token is string => Boolean(token),
  );
  return acceptedTokens.some((token) => token.length === provided.length && timingSafeEqual(Buffer.from(token), Buffer.from(provided)));
}

/** Transferred devices accept only their installed or in-flight credential. */
export function hasAssignedRouterAuth(request: Request, identity: string, device: { assignment_version: number; credential_version: number; assignment_applied_version: number | null }) {
  if (device.assignment_version === 0) return hasHotspotRouterAuth(request, identity);
  const provided = request.headers.get("x-manos-heartbeat") ?? "";
  const versions = device.assignment_applied_version === device.assignment_version
    ? [device.credential_version] : [device.credential_version, device.assignment_version];
  return versions.some(v => { const expected = hotspotRouterToken(identity,v); return expected && expected.length===provided.length && timingSafeEqual(Buffer.from(expected),Buffer.from(provided)); });
}
