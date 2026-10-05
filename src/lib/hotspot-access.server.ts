import { createHmac, randomBytes } from "node:crypto";
import { registerLead, resolvePortalTarget } from "@/lib/portal.server";

const CREDENTIAL_TTL_MS = 10 * 60 * 1000;
const USERNAME_PREFIX = "mt_";
const PORTAL_CONTEXT_COOKIE = "manos_hotspot_context";

// Safe guest-network defaults. A configured policy has priority; these values
// ensure a new MikroTik unit never creates an unlimited visitor session.
const DEFAULT_SESSION_TIMEOUT_SECONDS = 10 * 60;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 2 * 60;
const DEFAULT_DOWNLOAD_KBPS = 10_000;
const DEFAULT_UPLOAD_KBPS = 3_000;

export type HotspotLogin = {
  loginUrl: string;
  username: string;
  password: string;
  destination: string | null;
};

type PendingHotspotCheckin = {
  slug: string;
  fullName: string;
  email: string;
  countryCode: string;
  phone: string;
  city: string;
  consent: boolean;
  deviceType?: string;
  userAgent?: string;
  mac?: string;
  ip?: string;
  apMac?: string;
};

export type HotspotPortalContext = {
  slug: string;
  mac?: string;
  ip?: string;
  apMac?: string;
  loginOnly?: string;
  origin?: string;
  expiresAt: number;
};

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export function normalizeMacAddress(value: string | undefined) {
  if (!value) return null;
  const hex = value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(hex)) return null;
  return hex.match(/.{2}/g)?.join(":") ?? null;
}

/** Only an on-site private address can be the target of the browser login form. */
export function safeHotspotLoginUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const configuredSecureHost = process.env["HOTSPOT_LOGIN_HOST"]?.trim().toLowerCase();
    const isConfiguredSecureHost =
      url.protocol === "https:" &&
      Boolean(configuredSecureHost) &&
      url.hostname.toLowerCase() === configuredSecureHost;
    if (url.protocol !== "http:" && !isConfiguredSecureHost) return null;
    const host = url.hostname;
    const isPrivateV4 =
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    return (isPrivateV4 || isConfiguredSecureHost) && url.pathname === "/login" ? url.toString() : null;
  } catch {
    return null;
  }
}

function credentialSecret() {
  const secret = process.env["HOTSPOT_CREDENTIAL_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("A liberação do Wi-Fi ainda não está configurada.");
  }
  return secret;
}

function contextSignature(payload: string) {
  return createHmac("sha256", credentialSecret()).update(payload).digest("base64url");
}

/** Keeps MikroTik macros out of the visible portal URL and browser history. */
export function createHotspotPortalContext(context: Omit<HotspotPortalContext, "expiresAt">) {
  const payload = Buffer.from(
    JSON.stringify({ ...context, expiresAt: Date.now() + CREDENTIAL_TTL_MS }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${contextSignature(payload)}`;
}

export function readHotspotPortalContext(cookieHeader: string | null, expectedSlug: string) {
  const raw = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PORTAL_CONTEXT_COOKIE}=`))
    ?.slice(PORTAL_CONTEXT_COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature, ...rest] = raw.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  const expected = contextSignature(payload);
  if (signature.length !== expected.length || signature !== expected) return null;
  try {
    const context = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as HotspotPortalContext;
    return context.slug === expectedSlug && context.expiresAt > Date.now() ? context : null;
  } catch {
    return null;
  }
}

export function hotspotPortalContextCookie(value: string, slug: string) {
  // Server functions are invoked on an internal application route, not under
  // /portal. Scope to the first-party site so the signed context is available
  // to that server call while remaining HttpOnly and HTTPS-only.
  return `${PORTAL_CONTEXT_COOKIE}=${value}; Max-Age=${CREDENTIAL_TTL_MS / 1000}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function passwordFor(username: string) {
  return createHmac("sha256", credentialSecret()).update(username).digest("base64url");
}

export async function issueHotspotAccessGrant(
  admin: AdminClient,
  input: {
    companyId: string;
    portalTargetId: string;
    portalTargetKind: "company" | "branch" | "event";
    mac: string;
    loginUrl: string;
    destination?: string | null;
    pendingCheckin: PendingHotspotCheckin;
  },
): Promise<HotspotLogin> {
  const mac = normalizeMacAddress(input.mac);
  if (!mac) throw new Error("Não foi possível identificar o dispositivo no HotSpot.");

  const username = `${USERNAME_PREFIX}${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + CREDENTIAL_TTL_MS).toISOString();
  const { error } = await (admin as any).from("hotspot_access_grants").insert({
    company_id: input.companyId,
    portal_target_id: input.portalTargetId,
    portal_target_kind: input.portalTargetKind,
    username,
    mac_address: mac,
    expires_at: expiresAt,
    pending_checkin: input.pendingCheckin,
  });
  if (error) {
    console.error("[issueHotspotAccessGrant]", error);
    throw new Error("Não foi possível preparar o acesso ao Wi-Fi.");
  }

  return {
    loginUrl: input.loginUrl,
    username,
    password: passwordFor(username),
    destination: input.destination ?? null,
  };
}

export async function authorizeHotspotAccess(
  admin: AdminClient,
  input: { username: string | null; mac: string | null },
) {
  if (!input.username?.startsWith(USERNAME_PREFIX)) return null;
  const mac = normalizeMacAddress(input.mac ?? undefined);
  const { data, error } = await (admin as any)
    .from("hotspot_access_grants")
    .select(
      "id, username, mac_address, company_id, portal_target_id, portal_target_kind, pending_checkin, last_authenticated_at",
    )
    .eq("username", input.username)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) return null;
  // Some RouterOS/RADIUS setups omit Calling-Station-Id or format it
  // differently. The grant username is random, short-lived, and single-use;
  // accept a missing MAC while still rejecting a verifiable mismatch.
  if (mac && normalizeMacAddress(data.mac_address) !== mac) return null;

  // FreeRADIUS only calls this endpoint after the grant is valid and the RB
  // has accepted the credentials. Record the pending check-in exactly once;
  // repeated RADIUS retries see last_authenticated_at and do not duplicate it.
  if (!data.last_authenticated_at && data.pending_checkin) {
    const pending = data.pending_checkin as PendingHotspotCheckin;
    const target = await resolvePortalTarget(admin, pending.slug);
    if (!target) throw new Error("O portal associado a esta liberação não está disponível.");

    const lead = await registerLead(admin, target, {
      fullName: pending.fullName,
      email: pending.email,
      countryCode: pending.countryCode,
      phone: pending.phone,
      city: pending.city,
      consent: pending.consent,
      ...(pending.deviceType ? { deviceType: pending.deviceType } : {}),
      ...(pending.userAgent ? { userAgent: pending.userAgent } : {}),
      ...(pending.mac ? { mac: pending.mac } : {}),
      ...(pending.ip ? { ip: pending.ip } : {}),
      ...(pending.apMac ? { apMac: pending.apMac } : {}),
    });

    const countedMac = normalizeMacAddress(data.mac_address);
    if (countedMac) {
      const { error: countError } = await (admin as any).rpc("record_hotspot_mac_checkin", {
        p_grant_id: data.id,
        p_target_id: data.portal_target_id,
        p_mac_address: countedMac,
      });
      if (countError) throw new Error("Não foi possível registrar o check-in do dispositivo.");
    }

    const { error: finalizeError } = await (admin as any)
      .from("hotspot_access_grants")
      .update({
        visitor_id: lead.visitorId,
        last_authenticated_at: new Date().toISOString(),
        pending_checkin: null,
      })
      .eq("id", data.id)
      .is("last_authenticated_at", null);
    if (finalizeError) {
      console.error("[authorizeHotspotAccess] Could not finalize grant", finalizeError);
      throw new Error("Não foi possível confirmar o cadastro após a liberação do Wi-Fi.");
    }
  }

  const policyFields = "session_timeout_seconds, idle_timeout_seconds, download_kbps, upload_kbps";
  const companyPolicyQuery = () =>
    (admin as any)
      .from("hotspot_configs")
      .select(policyFields)
      .eq("company_id", data.company_id)
      .is("branch_id", null)
      .maybeSingle();

  let configuredPolicy: {
    session_timeout_seconds: number | null;
    idle_timeout_seconds: number | null;
    download_kbps: number | null;
    upload_kbps: number | null;
  } | null = null;

  if (data.portal_target_kind === "branch") {
    const { data: branchPolicy, error: branchPolicyError } = await (admin as any)
      .from("hotspot_configs")
      .select(policyFields)
      .eq("company_id", data.company_id)
      .eq("branch_id", data.portal_target_id)
      .maybeSingle();

    if (branchPolicyError) {
      console.error("[authorizeHotspotAccess] Could not load branch hotspot policy", branchPolicyError);
    }

    // Branch-specific values take precedence; missing values inherit the
    // company's policy. This also covers older branch rows without rate limits.
    const needsCompanyFallback =
      !branchPolicy ||
      branchPolicy.session_timeout_seconds == null ||
      branchPolicy.idle_timeout_seconds == null ||
      branchPolicy.download_kbps == null ||
      branchPolicy.upload_kbps == null;

    let companyPolicy = null;
    if (needsCompanyFallback) {
      const { data, error } = await companyPolicyQuery();
      if (error) {
        console.error("[authorizeHotspotAccess] Could not load company hotspot fallback", error);
      }
      companyPolicy = data;
    }

    configuredPolicy = {
      session_timeout_seconds:
        branchPolicy?.session_timeout_seconds ?? companyPolicy?.session_timeout_seconds ?? null,
      idle_timeout_seconds:
        branchPolicy?.idle_timeout_seconds ?? companyPolicy?.idle_timeout_seconds ?? null,
      download_kbps: branchPolicy?.download_kbps ?? companyPolicy?.download_kbps ?? null,
      upload_kbps: branchPolicy?.upload_kbps ?? companyPolicy?.upload_kbps ?? null,
    };
  } else {
    const { data, error } = await companyPolicyQuery();
    if (error) {
      console.error("[authorizeHotspotAccess] Could not load hotspot policy", error);
    }
    configuredPolicy = data;
  }

  return {
    username: data.username as string,
    password: passwordFor(data.username as string),
    sessionTimeoutSeconds:
      configuredPolicy?.session_timeout_seconds ?? DEFAULT_SESSION_TIMEOUT_SECONDS,
    idleTimeoutSeconds: configuredPolicy?.idle_timeout_seconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS,
    downloadKbps: configuredPolicy?.download_kbps ?? DEFAULT_DOWNLOAD_KBPS,
    uploadKbps: configuredPolicy?.upload_kbps ?? DEFAULT_UPLOAD_KBPS,
  };
}
