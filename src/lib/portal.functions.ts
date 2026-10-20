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
  normalizeMacAddress,
  safeHotspotLoginUrl,
  type HotspotLogin,
} from "@/lib/hotspot-access.server";
import { isSocialUrl, normalizeUrl } from "@/lib/url-utils";

/**
 * Destino que a RB usa no redirecionamento pos-autenticacao (dst).
 * Campanha normal: a propria URL da campanha. Rede social: a tela final
 * do portal (?conectado=1), que abre a rede social com a sessao ja
 * liberada — direto para o Instagram/Facebook, o navegador cativo do
 * iOS bloqueia a abertura do app com erro de sistema.
 */
function destinoAposLogin(
  redirectUrl: string | null | undefined,
  hotspotData: {
    hotspotOrig?: string | null | undefined;
    hotspotLinkOrig?: string | null | undefined;
    mac?: string | null | undefined;
  },
  request: Request | undefined,
  slug: string,
): string | null {
  const campanha = normalizeUrl(redirectUrl);
  if (campanha && isSocialUrl(campanha) && request) {
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    if (host) {
      // O MAC vai junto para a tela de retorno mostrar a contagem REAL de
      // acessos deste dispositivo (a conexao e registrada na autenticacao).
      const mac = normalizeMacAddress(hotspotData.mac ?? undefined);
      const extra = mac ? `&mac=${encodeURIComponent(mac)}` : "";
      return `${proto}://${host}/portal/${slug}?conectado=1${extra}`;
    }
  }
  return campanha ?? hotspotData.hotspotOrig ?? hotspotData.hotspotLinkOrig ?? null;
}

export const getPortal = createServerFn({ method: "GET" })
  .validator((data: unknown) => portalSlugSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await resolvePortalTarget(supabaseAdmin, data.slug);
    if (!target) return null;

    // Os assets do portal (logo, banners, patrocinadores) são exibidos para
    // QUALQUER visitante do Wi-Fi cativo: o bucket "campaign-assets" é público
    // para leitura (ver migration correspondente). Por isso usamos URL pública
    // ESTÁVEL em vez de assinada — cada portal gera a mesma URL, permitindo
    // cache de navegador + CDN e eliminando o re-download a cada visita
    // (o Storage era 95% do egress do projeto em 17/10/2026).
    const publicUrlFor = (path: string | null) => {
      if (!path) return null;
      // Se já é uma URL completa (pública ou legada), mantém como está
      if (path.startsWith("http")) return path;
      const { data } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(path);
      return data?.publicUrl ?? null;
    };

    const logoUrl = publicUrlFor(target.logoPath);

    const bannerUrls = (target.bannerPaths ?? [])
      .map((path) => publicUrlFor(path))
      .filter((url): url is string => Boolean(url));

    // Patrocinadores só existem em campanhas do tipo Evento (garantido no servidor).
    const sponsors =
      target.kind === "event"
        ? target.sponsors.map((sponsor) => ({
            id: sponsor.id,
            name: sponsor.name,
            displayType: sponsor.displayType,
            logoUrl: publicUrlFor(sponsor.logoPath),
            bannerUrl: publicUrlFor(sponsor.bannerPath),
            linkUrl: sponsor.linkUrl,
          }))
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

/**
 * Contagem REAL de acessos de um dispositivo (pelo MAC) na empresa do
 * portal. Usada pela tela de retorno pos-autenticacao (?conectado=1):
 * a conexao e registrada quando o RADIUS confirma, entao a tela busca
 * o numero verdadeiro em vez de chutar.
 */
export const getPortalConnectionCount = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { slug?: string; mac?: string };
    if (!d?.slug || !d?.mac) throw new Error("Parâmetros inválidos");
    return { slug: d.slug, mac: d.mac };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const target = await resolvePortalTarget(supabaseAdmin, data.slug);
    if (!target) return { count: 0 };
    const mac = normalizeMacAddress(data.mac);
    if (!mac) return { count: 0 };
    const variantes = Array.from(new Set([mac, data.mac.trim()]));
    const { count } = await (supabaseAdmin as any)
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("company_id", target.companyId)
      .in("mac_address", variantes);
    return { count: count ?? 0 };
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
          .select("id, device_id, assignment_version, mac_address, ip_address, ap_mac, login_only_url, origin_url")
          .eq("id", data.hotspotHandoff)
          .eq("slug", data.slug)
          .is("consumed_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle()
      : { data: null };
    if (data.hotspotHandoff && !handoff) throw new Error("A configuração do Wi-Fi mudou. Reconecte à rede para continuar.");
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
        .select("vendor, config, checkin_limit, checkin_block_minutes")
        .eq("company_id", target.companyId);

      hotspotQuery =
        target.kind === "branch"
          ? hotspotQuery.eq("branch_id", target.id)
          : hotspotQuery.is("branch_id", null);

      const { data: hotspot } = (await hotspotQuery.maybeSingle()) as {
        data: { vendor: HotspotVendor; config: Json; checkin_limit?: number | null; checkin_block_minutes?: number | null } | null;
      };

      if (hotspot?.vendor === "mikrotik_hotspot" || hotspot?.vendor === "mikrotik") {
        const mac = hotspotData.mac.replace(/[^a-fA-F0-9]/g, "").toUpperCase().match(/.{2}/g)?.join(":");
        if (!mac) throw new Error("Não foi possível identificar o dispositivo no HotSpot.");
        const { data: limitState, error: limitError } = await (supabaseAdmin as any).rpc(
          "check_hotspot_mac_checkin_limit",
          { p_target_id: target.id, p_mac_address: mac, p_limit: hotspot.checkin_limit ?? 3, p_block_minutes: hotspot.checkin_block_minutes ?? 30 },
        );
        if (limitError) throw new Error("Não foi possível validar o limite de check-ins.");
        const limit = Array.isArray(limitState) ? limitState[0] : limitState;
        if (limit?.blocked) {
          return { ok: true as const, isReturning: false, visitorId: null, connectionsCount: 0, hotspotReturnUrl: null, hotspotAccess: null, checkinBlocked: true, blockedUntil: limit.blocked_until };
        }
        const loginUrl = safeHotspotLoginUrl(hotspotData.hotspotLoginOnly);
        if (!loginUrl) {
          throw new Error("Não foi possível confirmar o endereço local do HotSpot.");
        }
        if (!handoff?.device_id) throw new Error("Abra o portal pela rede Wi-Fi para continuar.");
        hotspotAccess = await issueHotspotAccessGrant(supabaseAdmin, {
          deviceId: handoff.device_id,
          assignmentVersion: handoff.assignment_version,
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
            marketingConsent: data.marketingConsent,
            consentSource: "wifi_portal",
            consentIp: requestIp,
            portalSlug: data.slug,
            ...(data.deviceType ? { deviceType: data.deviceType } : {}),
            ...(data.userAgent ? { userAgent: data.userAgent } : {}),
            mac: hotspotData.mac,
            ip: hotspotData.ip,
            apMac: hotspotData.apMac,
          },
          // The campaign redirect is the visitor's intended destination.  It
          // must win over RouterOS's original-request fields, which are often
          // a captive-portal probe URL rather than the configured campaign URL.
          //
          // EXCECAO (redes sociais): o dst sai da RB direto para o navegador
          // cativo AINDA no inicio da sessao; a pagina do Instagram tenta
          // abrir o app (esquema instagram:) e o iOS bloqueia com um erro de
          // sistema ("nao pode redirecionar para localizacoes que comecam
          // com instagram:"). Para social, a RB devolve o visitante para a
          // tela final do portal (?conectado=1) e ELA abre a rede social
          // com a sessao ja liberada.
          destination: destinoAposLogin(target.redirectUrl, hotspotData, request, data.slug),
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
          marketingConsent: data.marketingConsent,
          consentSource: "wifi_portal",
          consentIp: requestIp,
          portalSlug: data.slug,
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
    return { ...leadResult, hotspotReturnUrl, hotspotAccess, checkinBlocked: false, blockedUntil: null };
  });

