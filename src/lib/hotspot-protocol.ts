export type HeartbeatInput = {
  routerIdentity?: string;
  mac?: string;
  ip?: string;
  version?: string;
  uptime?: string;
  rebootCommandId?: string;
  firewallBlocked?: string | boolean;
  activeSessions?: string | number;
  rxBytes?: string | number;
  txBytes?: string | number;
  latencyMs?: string | number;
  packetLossPct?: string | number;
};

function finiteNumber(value: string | number | undefined, min: number, max: number) {
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function routerUptimeSeconds(value: string | undefined) {
  if (!value) return null;
  const units: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let seconds = 0;
  const matches = [...value.matchAll(/(\d+)([wdhms])/g)];
  if (!matches.length || matches.map((match) => match[0]).join("") !== value) return null;
  for (const match of matches) seconds += Number(match[1]) * (units[match[2]!] ?? 0);
  return seconds;
}

export function validateHeartbeat(input: HeartbeatInput | null | undefined) {
  if (!input?.routerIdentity?.trim()) return false;
  if (input.rebootCommandId && !/^\d{13}$/.test(input.rebootCommandId)) return false;
  if (input.firewallBlocked !== undefined && input.firewallBlocked !== "" && ![true, false, "yes", "no"].includes(input.firewallBlocked)) return false;
  if (input.uptime && routerUptimeSeconds(input.uptime) === null) return false;
  if (input.latencyMs !== undefined && input.latencyMs !== "" && finiteNumber(input.latencyMs, 0, 3_600_000) === null) return false;
  if (input.packetLossPct !== undefined && input.packetLossPct !== "" && finiteNumber(input.packetLossPct, 0, 100) === null) return false;
  if (input.activeSessions !== undefined && finiteNumber(input.activeSessions, 0, 1_000_000) === null) return false;
  if (input.rxBytes !== undefined && finiteNumber(input.rxBytes, 0, Number.MAX_SAFE_INTEGER) === null) return false;
  if (input.txBytes !== undefined && finiteNumber(input.txBytes, 0, Number.MAX_SAFE_INTEGER) === null) return false;
  return true;
}

/**
 * RouterOS releases do not always serialize telemetry identically (notably
 * uptime and ping values). A valid, authenticated router must not lose its
 * heartbeat merely because one optional metric has an unfamiliar format.
 * Drop only malformed optional telemetry; identity and control fields keep
 * their strict validation in validateHeartbeat.
 */
export function sanitizeRouterOsHeartbeat(input: HeartbeatInput): HeartbeatInput {
  const sanitized: HeartbeatInput = { ...input };

  if (sanitized.uptime && routerUptimeSeconds(sanitized.uptime) === null) delete sanitized.uptime;

  const optionalNumbers: Array<keyof Pick<HeartbeatInput, "latencyMs" | "packetLossPct" | "activeSessions" | "rxBytes" | "txBytes">> = [
    "latencyMs",
    "packetLossPct",
    "activeSessions",
    "rxBytes",
    "txBytes",
  ];
  for (const field of optionalNumbers) {
    const value = sanitized[field];
    const bounds: Record<typeof field, readonly [number, number]> = {
      latencyMs: [0, 3_600_000],
      packetLossPct: [0, 100],
      activeSessions: [0, 1_000_000],
      rxBytes: [0, Number.MAX_SAFE_INTEGER],
      txBytes: [0, Number.MAX_SAFE_INTEGER],
    };
    if (value !== undefined && value !== "" && finiteNumber(value, ...bounds[field]) === null) delete sanitized[field];
  }

  if (sanitized.firewallBlocked !== undefined && sanitized.firewallBlocked !== "" && ![true, false, "yes", "no"].includes(sanitized.firewallBlocked)) {
    delete sanitized.firewallBlocked;
  }
  return sanitized;
}

export function heartbeatUpdate(input: HeartbeatInput, now: string, syncRequestedAt?: string | null) {
  return {
    ap_mac: input.mac,
    last_seen_at: now,
    last_seen_ip: input.ip ?? null,
    router_version: input.version ?? null,
    last_seen_uptime: input.uptime ?? null,
    active_sessions: finiteNumber(input.activeSessions, 0, 1_000_000) ?? 0,
    rx_bytes: finiteNumber(input.rxBytes, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    tx_bytes: finiteNumber(input.txBytes, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    latency_ms: finiteNumber(input.latencyMs, 0, 3_600_000),
    packet_loss_pct: finiteNumber(input.packetLossPct, 0, 100),
    // Store the request's own timestamp as the acknowledgement. If a newer
    // request races this heartbeat, it will still differ and remain pending.
    ...(syncRequestedAt ? { sync_applied_at: syncRequestedAt } : {}),
    updated_at: now,
  };
}
export function validateSyncRequest(input: { routerIdentity?: string } | null | undefined) { return Boolean(input?.routerIdentity?.trim()); }
