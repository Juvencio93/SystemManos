import { createServerFn } from "@tanstack/react-start";

import {
  portalLeadSchema,
  portalSlugSchema,
  registerLead,
  resolvePortalTarget,
} from "@/lib/portal.server";
import { Json } from "@/integrations/supabase/types";
import { HotspotVendor } from "@/lib/adapters";

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
    const limiterIdentity = data.ip?.trim()
      ? "ip:" + data.ip.trim()
      : "fp:" + data.email.trim().toLowerCase() + "|" + data.phone.trim() + "|" + (data.userAgent?.trim() || "unknown");
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
    const leadResult = await registerLead(supabaseAdmin, target, {
      fullName: data.fullName,
      email: data.email,
      countryCode: data.countryCode,
      phone: data.phone,
      city: data.city,
      consent: data.consent,
      deviceType: data.deviceType,
      userAgent: data.userAgent,
      mac: data.mac,
      ip: data.ip,
      apMac: data.apMac,
      hotspotLogin: data.hotspotLogin,
      hotspotLoginOnly: data.hotspotLoginOnly,
      hotspotOrig: data.hotspotOrig,
      hotspotLinkOrig: data.hotspotLinkOrig,
    });

    // Equipment release is attempted only when a configuration exists. Until a
    // vendor adapter is homologated, the adapter returns an explicit failure and
    // the current portal fallback (save and redirect) remains unchanged.
    if (data.mac && data.ip && target.kind !== "event") {
      const { getAdapter } = await import("./adapters");

      let hotspotQuery = supabaseAdmin
        .from("hotspot_configs")
        .select("vendor, config")
        .eq("company_id", target.companyId)
        .eq("is_active", true)
        .eq("status", "operational");

      hotspotQuery =
        target.kind === "branch"
          ? hotspotQuery.eq("branch_id", target.id)
          : hotspotQuery.is("branch_id", null);

      const { data: hotspot } = (await hotspotQuery.maybeSingle()) as {
        data: { vendor: HotspotVendor; config: Json } | null;
      };

      if (hotspot) {
        const adapter = getAdapter(hotspot.vendor);
        await adapter.release({
          mac: data.mac,
          ip: data.ip,
          username: data.email,
          config: hotspot.config || ({} as Json),
        });
      }
    }

    const hotspotReturnUrl = data.hotspotLoginOnly || data.hotspotLogin || null;
    return { ...leadResult, hotspotReturnUrl };
  });
