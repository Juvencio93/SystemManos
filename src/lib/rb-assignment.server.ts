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
# A limpeza NUNCA trava a confirmacao: a caixa busca este script a cada 120s
# e so sai de transfer_pending quando o ack chega. Hotspot ausente, perfil
# ausente, sessao que volta ou fetch que falha nao sao erro fatal: sao
# "nada a limpar" ou "tenta no proximo ciclo" (as paginas tem retry pelo
# marcador no comando normal). Um aborto aqui deixava a RB Online e presa
# em "Aguardando confirmacao" para sempre.
:local hs [/ip hotspot find where name="hotspot1"]
:if ([:len $hs] = 1) do={
  :do { /ip hotspot active remove [find where server="hotspot1"] } on-error={ :log warning "Manos Tech cleanup: active sessions kept" }
  :do { /ip hotspot cookie remove [find where user~"^mt_"] } on-error={ :log warning "Manos Tech cleanup: cookies kept" }
  :do { /ip hotspot user remove [find where name~"^mt_"] } on-error={ :log warning "Manos Tech cleanup: users kept" }
  :do { /ip hotspot ip-binding remove [find where comment~"^MANOS-TENANT"] } on-error={ :log warning "Manos Tech cleanup: bindings kept" }
  :local hp [/ip hotspot profile find where name="hsprof1"]
  :if ([:len $hp] = 1) do={ /ip hotspot profile set $hp login-by=http-chap,http-pap use-radius=yes }
}
:do { /tool fetch url="https://manostech-system.com.br/mikrotik/login.html" check-certificate=yes dst-path="flash/hotspot/login.html" } on-error={ :log warning "Manos Tech login page fetch failed; will retry" }
:do { /tool fetch url="https://manostech-system.com.br/mikrotik/alogin.html" check-certificate=yes dst-path="flash/hotspot/alogin.html" } on-error={ :log warning "Manos Tech alogin page fetch failed; will retry" }
${heartbeatScript(identity, hotspotRouterToken(identity, version)!)}
/tool fetch url="${ack}" http-method=post check-certificate=yes keep-result=no
`;
}
