import { createHmac, timingSafeEqual } from "node:crypto";
import { heartbeatScript } from "./rb-heartbeat-script.server";
import { hotspotRouterToken } from "./hotspot-router-auth";

export function assignmentSignature(identity: string, version: number) {
  const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"];
  if (!secret || secret.length < 32) throw new Error("Credencial de gestão indisponível.");
  return createHmac("sha256", secret).update(`rb-assignment:${identity}:${version}`).digest("hex");
}

export function validAssignmentSignature(identity: string, version: number, signature: string) {
  if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity) || !Number.isSafeInteger(version) || version < 1 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(assignmentSignature(identity, version)));
}

// Never reset bridges, WAN, firewall baseline, management or the physical identity.
// Idempotent until acknowledged; a failed fetch/import cannot advance the server state.
export function assignmentCleanupScript(identity: string, version: number) {
  if (!/^MT-[A-Z0-9-]{6,48}$/.test(identity) || !Number.isSafeInteger(version) || version < 1) throw new Error("Invalid assignment");
  const ack = `https://manostech-system.com.br/api/internal/hotspot-assignment-ack?routerIdentity=${identity}&version=${version}&signature=${assignmentSignature(identity, version)}`;
  return `# Manos Tech: apply assignment ${version}
:local hs [/ip hotspot find where name="hotspot1"]
:if ([:len $hs] != 1) do={ :error "Managed HotSpot not found" }
/ip hotspot active remove [find where server="hotspot1"]
/ip hotspot cookie remove [find where user~"^mt_"]
/ip hotspot user remove [find where name~"^mt_"]
/ip hotspot ip-binding remove [find where comment~"^MANOS-TENANT"]
/ip hotspot profile set [find where name="hsprof1"] login-by=http-chap,http-pap use-radius=yes
/tool fetch url="https://manostech-system.com.br/mikrotik/login.html" check-certificate=yes dst-path="flash/hotspot/login.html"
/tool fetch url="https://manostech-system.com.br/mikrotik/alogin.html" check-certificate=yes dst-path="flash/hotspot/alogin.html"
:if ([:len [/ip hotspot active find where server="hotspot1"]] > 0) do={ :error "Sessions remain" }
${heartbeatScript(identity, hotspotRouterToken(identity, version)!)}
/tool fetch url="${ack}" http-method=post check-certificate=yes keep-result=no
`;
}
