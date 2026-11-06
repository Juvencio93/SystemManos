import { assignmentCleanupScript } from "./rb-assignment.server";
import { assignmentAllowsAccess, type InventoryDevice } from "./rb-inventory";
import { macBypassCommand } from "./mac-bypass-script.server";
import { hotspotSyncAckSignature } from "./hotspot-router-auth";
import { createHash } from "node:crypto";

/**
 * Comando pendente da RB, compartilhado pelo GET /hotspot-command e pelo
 * piggyback do POST /hotspot-heartbeat.
 *
 * O GET continua sendo o transporte das RBs com o script antigo (elas fazem
 * o GET a cada ciclo e ignoram a resposta do heartbeat), por isso o builder
 * tem dois modos: `includeRefresh: true` reproduz o comportamento histórico
 * do GET (sempre devolve um script, com os blocos idempotentes de
 * RADIUS/login-page/MAC bypass); `includeRefresh: false` só devolve um
 * comando quando há trabalho pendente e retorna null no estado estável —
 * é o modo do piggyback.
 *
 * Limites contra loops sem expiração (auditoria de logs do Supabase, §G):
 * - reboot/sync expiram após ~30 min sem confirmação (vira auditoria
 *   `reboot_expired`/`sync_expired` → intervenção manual);
 * - reboot só é reenviado no máximo 5 vezes por solicitação;
 * - a página de login só é reenviada 1×/hora (o marcador na RB é o
 *   estado real; aqui o servidor limita o reenvio do bloco).
 */

export const REBOOT_REQUEST_TTL_MS = 30 * 60_000;
export const SYNC_REQUEST_TTL_MS = 30 * 60_000;
export const MAX_REBOOT_DISPATCHES = 5;
export const REBOOT_DISPATCH_MIN_INTERVAL_MS = 30_000;
export const LOGIN_SYNC_MIN_INTERVAL_MS = 60 * 60_000;

export const NO_OP_COMMAND = "# no-op\n";

const COMMAND_HEADERS = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate" };
export const hotspotCommandHeaders = COMMAND_HEADERS;

export class RebootDispatchAuditError extends Error {
  constructor() {
    super("Could not audit reboot dispatch");
    this.name = "RebootDispatchAuditError";
  }
}

/** Subconjunto da linha de hotspot_devices que o builder precisa. */
export type HotspotCommandDevice = {
  id: string;
  status: string;
  company_id: string | null;
  branch_id?: string | null;
  hotspot_config_id: string | null;
  assignment_version: number;
  assignment_applied_version: number | null;
  pending_router_identity?: string | null;
  router_applied_status?: string | null;
  reboot_requested_at?: string | null;
  router_status_requested_at?: string | null;
  router_status_applied_at?: string | null;
  sync_requested_at?: string | null;
  sync_applied_at?: string | null;
};

export type HotspotCommandDb = {
  from(table: string): any;
};

export function isRequestExpired(requestedAt: string | null | undefined, nowMs: number, ttlMs: number) {
  if (!requestedAt) return false;
  const requestedMs = Date.parse(requestedAt);
  if (!Number.isFinite(requestedMs)) return false;
  return nowMs - requestedMs >= ttlMs;
}

function syncPending(device: HotspotCommandDevice, nowMs: number) {
  return Boolean(
    device.sync_requested_at &&
      device.sync_applied_at !== device.sync_requested_at &&
      !isRequestExpired(device.sync_requested_at, nowMs, SYNC_REQUEST_TTL_MS),
  );
}

function rebootPending(device: HotspotCommandDevice, nowMs: number) {
  return Boolean(
    device.reboot_requested_at &&
      !isRequestExpired(device.reboot_requested_at, nowMs, REBOOT_REQUEST_TTL_MS),
  );
}

/** Puro: há algum comando pendente para esta RB? (usado pelo piggyback e nos testes) */
export function hasPendingHotspotCommand(
  device: HotspotCommandDevice,
  commandIdFromRouter: string,
  nowMs = Date.now(),
) {
  if (device.assignment_applied_version !== device.assignment_version) return true;
  if (rebootPending(device, nowMs)) return true;
  if (commandIdFromRouter) return true;
  if (syncPending(device, nowMs)) return true;
  if (device.router_status_requested_at && device.router_status_applied_at !== device.router_status_requested_at) return true;
  const blocked = !assignmentAllowsAccess(device as InventoryDevice);
  if (device.router_applied_status !== (blocked ? "blocked" : "unblocked")) return true;
  return false;
}

/**
 * Expira solicitações de reboot/sync sem confirmação há mais de ~30 min:
 * limpa o pedido (a RB para de receber o comando) e grava uma linha de
 * auditoria (`reboot_expired`/`sync_expired`) — é assim que a RB é marcada
 * para intervenção manual (o painel mostra o evento no histórico e o alerta).
 * Sem pedido expirado, não toca no banco e devolve o device intacto.
 */
export async function expireStaleRequests(
  db: HotspotCommandDb,
  device: HotspotCommandDevice,
  nowIso: string,
): Promise<{ device: HotspotCommandDevice; expired: Array<"reboot" | "sync"> }> {
  const nowMs = Date.parse(nowIso);
  const expired: Array<"reboot" | "sync"> = [];
  if (device.reboot_requested_at && isRequestExpired(device.reboot_requested_at, nowMs, REBOOT_REQUEST_TTL_MS)) expired.push("reboot");
  if (device.sync_requested_at && isRequestExpired(device.sync_requested_at, nowMs, SYNC_REQUEST_TTL_MS)) expired.push("sync");
  if (expired.length === 0) return { device, expired };

  const patch: { reboot_requested_at?: string | null; sync_requested_at?: string | null; updated_at: string } = {
    updated_at: nowIso,
  };
  if (expired.includes("reboot")) patch.reboot_requested_at = null;
  if (expired.includes("sync")) patch.sync_requested_at = null;
  const { error } = await db.from("hotspot_devices").update(patch).eq("id", device.id);
  if (error) {
    console.error("[rb-command] Could not expire stale device requests", error);
    return { device, expired: [] };
  }
  for (const kind of expired) {
    const { error: auditError } = await db.from("hotspot_device_audit").insert({
      action: kind === "reboot" ? "reboot_expired" : "sync_expired",
      device_id: device.id,
      new_status: kind === "reboot" ? "reboot_expired" : "sync_expired",
      created_at: nowIso,
    });
    if (auditError) console.error("[rb-command] Could not audit expired device request", auditError);
  }
  return { device: { ...device, ...patch }, expired };
}

// --- Blocos de script RouterOS (antes em hotspot-command.ts, sem alteração) ---

const BLOCK_RULES = [
  ["MANOS-BLOCK-HOTSPOT-FORWARD", "forward", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-FORWARD", "forward", "192.168.89.0/24"],
  ["MANOS-BLOCK-HOTSPOT-INPUT", "input", "192.168.88.0/24"],
  ["MANOS-BLOCK-LIVRE-INPUT", "input", "192.168.89.0/24"],
] as const;

function radiusMarker(secret: string) {
  return `MANOS-RADIUS-${createHash("sha256").update(secret).digest("hex").slice(0, 16)}-V5`;
}

function firewallStateScript() {
  const tests = BLOCK_RULES.map(([comment]) => `:if ([:len [/ip firewall filter find where comment="${comment}" disabled=no]] > 0) do={ :set blockedRuleCount ($blockedRuleCount + 1) }`).join("\n");
  return `:local blockedRuleCount 0\n${tests}\n:local firewallState "no"\n:if ($blockedRuleCount = 4) do={ :set firewallState "yes" }\n:local expectedComment ("MANOS-FW-" . $firewallState)\n:local schedulerId [/system scheduler find where name="MANOS-HEARTBEAT"]\n:if ([:len $schedulerId] > 0 && [/system scheduler get $schedulerId comment] != $expectedComment) do={ /system scheduler set $schedulerId comment=$expectedComment }\n`;
}

function statusCommand(blocked: boolean) {
  const removeManagedRule = (comment: string) => `:if ([:len [/ip firewall filter find where comment="${comment}"]] > 0) do={ /ip firewall filter remove [find where comment="${comment}"] }`;
  if (!blocked) {
    return `${BLOCK_RULES.map(([comment]) => removeManagedRule(comment)).join("\n")}\n${removeManagedRule("MANOS-BLOCK-ETHER5")}\n`;
  }
  return `# Quarantine all RB-routed networks. ether5 remains a transparent provider-LAN bridge.
${removeManagedRule("MANOS-BLOCK-ETHER5")}
${BLOCK_RULES.map(([comment, chain, subnet]) => `:if ([:len [/ip firewall filter find where comment="${comment}"]] = 0) do={/ip firewall filter add chain=${chain} src-address=${subnet} action=drop comment="${comment}"} else={/ip firewall filter set [find where comment="${comment}"] disabled=no}; :local manosFirstRule [:pick [/ip firewall filter find] 0]; :local manosManagedRule [:pick [/ip firewall filter find where comment="${comment}"] 0]; :if ($manosManagedRule != $manosFirstRule) do={/ip firewall filter move $manosManagedRule destination=$manosFirstRule}`).join("\n")}
`;
}

function schedulerIntervalCommand() {
  return `:local hsSched [/system scheduler find where name="MANOS-HEARTBEAT"]
:if ([:len $hsSched] > 0) do={
  :local curInterval [/system scheduler get $hsSched interval]
  :if ($curInterval != 2m && $curInterval != 120s) do={
    /system scheduler set $hsSched interval=120s
    :log info "Manos Tech: heartbeat interval adjusted to 120s"
  }
}
`;
}

function hotspotLoginFileSyncCommand() {
  // Upgrade the on-router login page once. This keeps the credentials POST
  // same-origin with RouterOS and retries on later heartbeats if a fetch fails.
  return `:if ([:len [/file find where name="flash/manos-login-v3.marker"]] = 0) do={
  :do {
    :local manosLoginFetch [/tool fetch url="https://manostech-system.com.br/mikrotik/login.html" mode=https dst-path="flash/hotspot/login.html" check-certificate=yes as-value]
    :if (($manosLoginFetch->"status") = "finished") do={
      :local manosAloginFetch [/tool fetch url="https://manostech-system.com.br/mikrotik/alogin.html" mode=https dst-path="flash/hotspot/alogin.html" check-certificate=yes as-value]
      :if (($manosAloginFetch->"status") = "finished") do={
        /tool fetch url="https://manostech-system.com.br/mikrotik/manos-login-v3.marker" mode=https dst-path="flash/manos-login-v3.marker" check-certificate=yes
      }
    }
  } on-error={ :log warning "Manos Tech login page update failed; will retry" }
}
`;
}

function syncAcknowledgementCommand(identity: string, requestedAt: string, blocked: boolean) {
  const requestId = String(Date.parse(requestedAt));
  if (!/^\d{13}$/.test(requestId)) return "";
  const signature = hotspotSyncAckSignature(identity, requestId);
  if (!signature) return "";
  const firewallState = blocked ? "yes" : "no";
  const url = `https://manostech-system.com.br/api/internal/hotspot-sync-ack?routerIdentity=${identity}&requestId=${requestId}&signature=${signature}`;
  // These checks run after the commands above. An import or fetch failure
  // leaves the request pending instead of reporting a false success.
  return `:if ([:len [/radius find where service=hotspot comment~"^MANOS-RADIUS" disabled=no]] = 0) do={ :error "Manos Tech RADIUS sync not confirmed" }
:if ([:len [/file find where name="flash/manos-login-v3.marker"]] = 0) do={ :error "Manos Tech login sync not confirmed" }
:if ([:len [/system scheduler find where name="MANOS-HEARTBEAT" comment="MANOS-FW-${firewallState}"]] = 0) do={ :error "Manos Tech firewall sync not confirmed" }
/tool fetch url="${url}" http-method=post http-data="" output=none check-certificate=yes
`;
}

/**
 * A router that is already proving its identity through the heartbeat can
 * safely receive the current RADIUS credential over that TLS channel. The
 * marker makes credential rotations idempotent. The same heartbeat also
 * repairs an accidentally disabled RADIUS entry, which otherwise silently
 * prevents HotSpot logins even when the shared secret is correct.
 */
function radiusCredentialCommand() {
  const host = process.env["MIKROTIK_RADIUS_HOST"]?.trim();
  const secret = process.env["MIKROTIK_RADIUS_SECRET"]?.trim();
  if (!host || !/^[A-Za-z0-9.-]{1,253}$/.test(host) || !secret || !/^[A-Za-z0-9_-]{16,128}$/.test(secret)) return "";
  const marker = radiusMarker(secret);
  // RouterOS never returns the RADIUS secret. The version marker is therefore
  // the proof that this managed secret was last applied. A marker change (for
  // example, after a credential rotation) causes one update; normal 5-second
  // telemetry cycles only read the configuration and do not rewrite it.
  return `:local manosRadiusId [/radius find where service=hotspot comment~"^MANOS-RADIUS"]
:local manosRadiusNeedsUpdate true
:if ([:len $manosRadiusId] > 0) do={
  :local manosRadiusItem [:pick $manosRadiusId 0]
  :if (([/radius get $manosRadiusItem comment] = "${marker}") && ([/radius get $manosRadiusItem address] = "${host}") && ([/radius get $manosRadiusItem disabled] = false)) do={ :set manosRadiusNeedsUpdate false }
}
:if ($manosRadiusNeedsUpdate && [:len $manosRadiusId] = 0) do={
  /radius add service=hotspot address="${host}" secret="${secret}" authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${marker}"
}
:if ($manosRadiusNeedsUpdate && [:len $manosRadiusId] > 0) do={
  /radius set $manosRadiusId service=hotspot address="${host}" secret="${secret}" authentication-port=1812 accounting-port=1813 timeout=3s require-message-auth=no disabled=no comment="${marker}"
}
`;
}

async function lastLoginSyncDispatchAt(db: HotspotCommandDb, deviceId: string): Promise<number | null> {
  const { data } = await db
    .from("hotspot_device_audit")
    .select("created_at")
    .eq("device_id", deviceId)
    .eq("action", "login_page_sync_dispatched")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const createdAt = (data as { created_at?: string } | null)?.created_at;
  return createdAt ? Date.parse(createdAt) : null;
}

/**
 * Monta o comando RouterOS para a RB.
 *
 * Ordem (idêntica à do GET histórico): assignment → reboot → limpar
 * comentário de reboot → script padrão. Em modo piggyback
 * (`includeRefresh: false`) retorna null quando não há trabalho pendente —
 * o estado estável não gera comando e a RB não precisa do GET.
 * Em modo GET (`includeRefresh: true`) sempre retorna um script.
 *
 * Lança RebootDispatchAuditError se a auditoria do dispatch falhar
 * (o GET histórico respondia 500 nesse caso; o heartbeat trata como
 * ausência de piggyback e a RB busca o comando pelo GET).
 */
export async function buildHotspotCommand(
  db: HotspotCommandDb,
  options: {
    identity: string;
    commandIdFromRouter: string;
    device: HotspotCommandDevice;
    includeRefresh: boolean;
  },
): Promise<string | null> {
  const { identity, commandIdFromRouter, includeRefresh } = options;
  const device = options.device;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  if (device.assignment_applied_version !== device.assignment_version) {
    // Rename pendente: a caixa adota o nome novo ANTES do cleanup; o resto
    // do script (heartbeat + ack) já sai com a identidade nova.
    const pendingIdentity = device.pending_router_identity ?? null;
    const renamePending = Boolean(
      pendingIdentity && /^MT-[A-Z0-9-]{6,48}$/.test(pendingIdentity),
    );
    const cleanup = renamePending && pendingIdentity
      ? `/system identity set name=${pendingIdentity}\n` + assignmentCleanupScript(pendingIdentity, device.assignment_version)
      : assignmentCleanupScript(identity, device.assignment_version);
    return statusCommand(true) + cleanup;
  }

  if (rebootPending(device, nowMs)) {
    const expectedCommandId = String(Date.parse(device.reboot_requested_at!));

    // Reenvio limitado: no máximo MAX_REBOOT_DISPATCHES por solicitação.
    // Depois disso a RB só recebe o comando de novo por ação humana
    // (nova solicitação, após a expiração de 30 min limpar o pedido).
    const { data: dispatchRows } = await db
      .from("hotspot_device_audit")
      .select("created_at")
      .eq("device_id", device.id)
      .eq("action", "reboot_dispatched")
      .gte("created_at", device.reboot_requested_at)
      .order("created_at", { ascending: false })
      .limit(MAX_REBOOT_DISPATCHES + 1);
    const dispatches = ((dispatchRows ?? []) as { created_at: string }[]);
    if (dispatches.length >= MAX_REBOOT_DISPATCHES) {
      const { data: limitRow } = await db
        .from("hotspot_device_audit")
        .select("id")
        .eq("device_id", device.id)
        .eq("action", "reboot_dispatch_limit")
        .gte("created_at", device.reboot_requested_at)
        .limit(1)
        .maybeSingle();
      if (!limitRow) {
        const { error } = await db.from("hotspot_device_audit").insert({
          action: "reboot_dispatch_limit",
          device_id: device.id,
          new_status: "reboot_dispatch_limit",
          created_at: now,
        });
        if (error) console.error("[rb-command] Could not audit reboot dispatch limit", error);
      }
      return NO_OP_COMMAND;
    }

    // A marker proves that a command was received, but not that RouterOS
    // actually rebooted. The old flow stopped forever after writing the
    // marker when the reboot itself failed. Retry at a controlled pace
    // until a post-boot heartbeat confirms the restart.
    const lastDispatch = dispatches[0]?.created_at;
    if (lastDispatch && nowMs - Date.parse(lastDispatch) < REBOOT_DISPATCH_MIN_INTERVAL_MS) {
      return NO_OP_COMMAND;
    }

    const { error: auditError } = await db.from("hotspot_device_audit").insert({
      action: "reboot_dispatched",
      device_id: device.id,
      new_status: "reboot_dispatched",
      created_at: now,
    });
    if (auditError) throw new RebootDispatchAuditError();

    // Run the reboot outside the imported command file. This lets the
    // import finish cleanly before RouterOS terminates the current job.
    return `/system script set [find where name="MANOS-HEARTBEAT"] comment="MANOS-REBOOT-${expectedCommandId}"\n:execute {:delay 2s; /system reboot}\n`;
  }

  if (commandIdFromRouter) {
    return '/system script set [find where name="MANOS-HEARTBEAT"] comment=""\n';
  }

  const pending = syncPending(device, nowMs);
  const statusPending = Boolean(device.router_status_requested_at && device.router_status_applied_at !== device.router_status_requested_at);
  const blocked = !assignmentAllowsAccess(device as InventoryDevice);
  const radiusCommand = radiusCredentialCommand();
  const confirmation = pending && radiusCommand && device.sync_requested_at
    ? syncAcknowledgementCommand(identity, device.sync_requested_at, blocked)
    : "";
  const reportedStatusMismatch = device.router_applied_status !== (blocked ? "blocked" : "unblocked");
  if (!includeRefresh && !pending && !statusPending && !reportedStatusMismatch && !confirmation) return null;

  // Página de login: 1×/hora, não 1×/120s. O marcador na RB é o estado
  // real; o servidor limita o reenvio do bloco e registra cada envio.
  // Com sync pendente o bloco vai sempre (o ack exige o marcador), mas o
  // registro continua 1×/hora — sem ele, um sync travado geraria uma
  // linha de auditoria por ciclo.
  const lastLoginDispatch = await lastLoginSyncDispatchAt(db, device.id);
  const loginDue = lastLoginDispatch === null || nowMs - lastLoginDispatch >= LOGIN_SYNC_MIN_INTERVAL_MS;
  const includeLogin = pending || loginDue;
  if (includeLogin && loginDue) {
    const { error } = await db.from("hotspot_device_audit").insert({
      action: "login_page_sync_dispatched",
      device_id: device.id,
      new_status: "login_page_sync_dispatched",
      created_at: now,
    });
    if (error) console.error("[rb-command] Could not audit login page sync dispatch", error);
  }

  const firewallCheck = statusPending || confirmation || reportedStatusMismatch ? `\n${firewallStateScript()}` : "";
  // Dispositivos liberados (MAC bypass): a RB sincroniza os ip-bindings.
  // Vale para a empresa toda (branch_id null) ou para a filial da RB.
  let macBypass = "";
  try {
    const { data: config } = await db
      .from("hotspot_configs")
      .select("branch_id")
      .eq("id", device.hotspot_config_id)
      .maybeSingle();
    const branchId = (config as { branch_id?: string | null } | null)?.branch_id ?? null;
    const { data: macRows } = await db
      .from("hotspot_mac_bypass")
      .select("mac_address, branch_id")
      .eq("company_id", device.company_id);
    const macs = ((macRows ?? []) as { mac_address: string; branch_id: string | null }[])
      .filter((r) => r.branch_id === null || r.branch_id === branchId)
      .map((r) => r.mac_address);
    macBypass = `\n${macBypassCommand(macs)}`;
  } catch {
    macBypass = "";
  }
  return `${schedulerIntervalCommand()}${radiusCommand}${includeLogin ? hotspotLoginFileSyncCommand() : ""}${statusCommand(blocked)}${firewallCheck}${confirmation}${macBypass}`;
}
