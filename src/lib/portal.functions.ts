import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  portalLeadSchema,
  portalSlugSchema,
  registerLead,
  resolvePortalTarget,
  toE164,
} from "@/lib/portal.server";
import { validateContact } from "@/lib/contact-validation.server";
import { Json } from "@/integrations/supabase/types";
import { HotspotVendor } from "@/lib/adapters";
import {
  issueHotspotAccessGrant,
  safeHotspotLoginUrl,
  type HotspotLogin,
} from "@/lib/hotspot-access.server";
import { normalizeUrl } from "@/lib/url-utils";

export const getPortal = createServerFn({ method: "GET" })
  .validator((data: unknown) => portalSlugSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await resolvePortalTarget(supabaseAdmin, data.slug);
    if (!target) return null;

    const sign = async (path: string | null) => {
      if (!path) return null;
      // If it's already a full URL (signed or public), return as is
      if (path.startsWith("http")) return path;
      const { data: signed } = await supabaseAdmin.storage
        .from("campaign-assets")
        .createSignedUrl(path, 60 * 60 * 6);
      return signed?.signedUrl ?? null;
    };

    const logoUrl = await sign(target.logoPath);

    const bannerUrls = (
      await Promise.all((target.bannerPaths ?? []).map((path) => sign(path)))
    ).filter((url): url is string => Boolean(url));

    // Patrocinadores só existem em campanhas do tipo Evento (garantido no servidor).
    const sponsors =
      target.kind === "event"
        ? await Promise.all(
            target.sponsors.map(async (sponsor) => ({
              id: sponsor.id,
              name: sponsor.name,
              displayType: sponsor.displayType,
              logoUrl: await sign(sponsor.logoPath),
              bannerUrl: await sign(sponsor.bannerPath),
              linkUrl: sponsor.linkUrl,
            })),
          )
        : [];

    return {
      kind: target.kind,
      name: target.name,
      companyName: target.companyName,
      location: target.location,
      campaignName: target.campaignName,
      campaignDescription: target.campaignDescription,
      logoUrl,
      bannerUrls,
      redirectUrl: target.redirectUrl,
      appearance: target.appearance,
      sponsors,
    };
  });

export const submitPortalLead = createServerFn({ method: "POST" })
  .validator((data: unknown) => portalLeadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await resolvePortalTarget(supabaseAdmin, data.slug);
    if (!target) throw new Error("Portal indisponivel");

    // Throttle public check-ins before any visitor, lead or connection writes.
    const request = getRequest();
    const { data: handoff } = data.hotspotHandoff
      ? await (supabaseAdmin as any)
          .from("hotspot_portal_handoffs")
          .select("id, mac_address, ip_address, ap_mac, login_only_url, origin_url")
          .eq("id", data.hotspotHandoff)
          .eq("slug", data.slug)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle()
      : { data: null };
    const hotspotData = handoff
      ? {
          ...data,
          mac: handoff.mac_address,
          ip: handoff.ip_address,
          apMac: handoff.ap_mac,
          hotspotLoginOnly: handoff.login_only_url,
          hotspotOrig: handoff.origin_url,
          hotspotLogin: undefined,
          hotspotLinkOrig: undefined,
        }
      : data;
    const requestIp = request?.headers.get("x-vercel-forwarded-for")
      || request?.headers.get("cf-connecting-ip")
      || request?.headers.get("x-real-ip")
      || request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown";
    const limiterIdentity = "ip:" + requestIp;
    const limiterKey = "portal:" + target.id + ":" + limiterIdentity;
    const { data: allowed, error: limiterError } = await (supabaseAdmin as any).rpc(
      "consume_portal_checkin_rate_limit",
      { p_bucket_key: limiterKey, p_limit: 10, p_window_seconds: 60 },
    );
    if (limiterError) {
      console.error("[submitPortalLead] Rate limiter unavailable:", limiterError);
      throw new Error("Não foi possível validar esta tentativa. Tente novamente em instantes.");
    }
    if (allowed !== true) {
      throw new Error("Muitas tentativas de acesso. Aguarde um minuto e tente novamente.");
    }

    const contactValidation = await validateContact(data.email, toE164(data.countryCode, data.phone));
    if (contactValidation.status === "invalid") {
      throw new Error("Verifique o e-mail digitado e o número de celular digitado.");
    }
    let hotspotAccess: HotspotLogin | null = null;
    let isPendingHotspotAuthorization = false;

    // MikroTik is released by a short-lived credential that FreeRADIUS validates
    // through the private API. No router or RADIUS secret is ever sent to browser.
    if (hotspotData.mac && hotspotData.ip && target.kind !== "event") {
      let hotspotQuery = supabaseAdmin
        .from("hotspot_configs")
        .select("vendor, config")
        .eq("company_id", target.companyId);

      hotspotQuery =
        target.kind === "branch"
          ? hotspotQuery.eq("branch_id", target.id)
          : hotspotQuery.is("branch_id", null);

      const { data: hotspot } = (await hotspotQuery.maybeSingle()) as {
        data: { vendor: HotspotVendor; config: Json } | null;
      };

      if (hotspot?.vendor === "mikrotik_hotspot" || hotspot?.vendor === "mikrotik") {
        const loginUrl = safeHotspotLoginUrl(hotspotData.hotspotLoginOnly);
        if (!loginUrl) {
          throw new Error("Não foi possível confirmar o endereço local do HotSpot.");
        }
        hotspotAccess = await issueHotspotAccessGrant(supabaseAdmin, {
          companyId: target.companyId,
          portalTargetId: target.id,
          portalTargetKind: target.kind,
          mac: hotspotData.mac,
          loginUrl,
          pendingCheckin: {
            slug: data.slug,
            fullName: data.fullName,
            email: data.email,
            countryCode: data.countryCode,
            phone: data.phone,
            city: data.city,
            consent: data.consent,
            ...(data.deviceType ? { deviceType: data.deviceType } : {}),
            ...(data.userAgent ? { userAgent: data.userAgent } : {}),
            mac: hotspotData.mac,
            ip: hotspotData.ip,
            apMac: hotspotData.apMac,
          },
          // The campaign redirect is the visitor's intended destination.  It
          // must win over RouterOS's original-request fields, which are often
          // a captive-portal probe URL rather than the configured campaign URL.
          destination: normalizeUrl(target.redirectUrl) ?? hotspotData.hotspotOrig ?? hotspotData.hotspotLinkOrig ?? null,
        });
        await (supabaseAdmin as any)
          .from("hotspot_portal_handoffs")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", handoff?.id ?? "");
        isPendingHotspotAuthorization = true;
      } else if (hotspot) {
        const { getAdapter } = await import("./adapters");
        const adapter = getAdapter(hotspot.vendor);
        await adapter.release({
          mac: hotspotData.mac,
          ip: hotspotData.ip,
          username: data.email,
          config: hotspot.config || ({} as Json),
        });
      }
    }

    const leadResult = isPendingHotspotAuthorization
      ? { ok: true as const, isReturning: false, visitorId: null, connectionsCount: 0 }
      : await registerLead(supabaseAdmin, target, {
          fullName: data.fullName,
          email: data.email,
          countryCode: data.countryCode,
          phone: data.phone,
          city: data.city,
          consent: data.consent,
          deviceType: data.deviceType,
          userAgent: data.userAgent,
          mac: hotspotData.mac,
          ip: hotspotData.ip,
          apMac: hotspotData.apMac,
          hotspotLogin: hotspotData.hotspotLogin,
          hotspotLoginOnly: hotspotData.hotspotLoginOnly,
          hotspotOrig: hotspotData.hotspotOrig,
          hotspotLinkOrig: hotspotData.hotspotLinkOrig,
        });

    const hotspotReturnUrl = hotspotAccess?.loginUrl ?? (hotspotData.hotspotLoginOnly || hotspotData.hotspotLogin || null);
    return { ...leadResult, hotspotReturnUrl, hotspotAccess };
  });

