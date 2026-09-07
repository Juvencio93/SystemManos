import { Json } from "@/integrations/supabase/types";
import { z } from "zod";
import { normalizePortalAppearance, type PortalAppearance } from "@/lib/campaign-appearance";
import { normalizeSponsorDisplayType, type SponsorDisplayType } from "@/lib/campaign-sponsors";

export const portalSlugSchema = z.object({ slug: z.string().trim().min(1).max(120) });

export const portalLeadSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(120),
  email: z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido").max(180),
  countryCode: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/, "Código do país inválido")
    .default("+55"),
  phone: z
    .string()
    .trim()
    .min(8, "Informe um WhatsApp válido")
    .max(20)
    .refine((val) => /^\d+$/.test(val), "Informe apenas números no WhatsApp")
    .refine((val) => !/^0+$/.test(val), "WhatsApp inválido"),
  city: z.string().trim().min(2, "Informe sua cidade").max(120), // Cidade agora obrigatória
  consent: z.boolean().refine((val) => val === true, "E necessário aceitar a política LGPD"),
  // O portal possui um único aceite obrigatório. O mesmo aceite é registrado
  // para LGPD e para o contato comercial pelo WhatsApp, conforme o texto
  // apresentado ao visitante no formulário.
  marketingConsent: z.boolean().optional(),
  deviceType: z.string().trim().max(40).optional(),
  userAgent: z.string().trim().max(400).optional(),
  mac: z.string().trim().max(100).optional(),
  ip: z.string().trim().max(100).optional(),
  apMac: z.string().trim().max(100).optional(),
  hotspotLogin: z.string().url().max(2000).optional(),
  hotspotLoginOnly: z.string().url().max(2000).optional(),
  hotspotOrig: z.string().url().max(2000).optional(),
  hotspotLinkOrig: z.string().url().max(2000).optional(),
});

export type PortalTarget = {
  kind: "branch" | "event" | "company";
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  location: string | null;
  dailyResetTime: string;
  campaignId: string | null;
  campaignName: string | null; // Note: In DB this is campaigns.name, which user wants to be "Internal Name". But in Portal we should maybe NOT show it? User says: "O campo 'Nome' NÃO deve ser exibido no Portal Cativo."
  campaignDescription: string | null; // This will be "Mensagem do Portal"
  logoPath: string | null;
  bannerPaths: string[];
  redirectUrl: string | null;
  appearance: PortalAppearance;
  /** Patrocinadores existem apenas em campanhas do tipo Evento. */
  sponsors: PortalSponsorRecord[];
};

export type PortalSponsorRecord = {
  id: string;
  name: string;
  displayType: SponsorDisplayType;
  logoPath: string | null;
  bannerPath: string | null;
  linkUrl: string | null;
};

/** Busca patrocinadores ativos da campanha (somente campanhas de evento). */
async function eventSponsors(admin: AdminClient, campaignId: string | null | undefined) {
  if (!campaignId) return [] as PortalSponsorRecord[];
  const { data } = await admin
    .from("campaign_sponsors")
    .select("id, name, display_type, logo_path, banner_path, link_url, sort_order")
    .eq("campaign_id", campaignId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    displayType: normalizeSponsorDisplayType(row.display_type),
    logoPath: row.logo_path ?? null,
    bannerPath: row.banner_path ?? null,
    linkUrl: row.link_url ?? null,
  }));
}

const campaignAppearanceFields =
  "primary_color, accent_color, visual_style, logo_position, button_text, autoplay_enabled, show_arrows, show_indicators, show_progress_bar, quick_info_1, quick_info_2, quick_info_3";

function campaignAppearance(campaign: {
  primary_color?: string | null;
  accent_color?: string | null;
  visual_style?: string | null;
  logo_position?: string | null;
  button_text?: string | null;
  autoplay_enabled?: boolean | null;
  show_arrows?: boolean | null;
  show_indicators?: boolean | null;
  show_progress_bar?: boolean | null;
  quick_info_1?: string | null;
  quick_info_2?: string | null;
  quick_info_3?: string | null;
} | null | undefined): PortalAppearance {
  return normalizePortalAppearance({
    primaryColor: campaign?.primary_color ?? undefined,
    accentColor: campaign?.accent_color ?? undefined,
    visualStyle: campaign?.visual_style as PortalAppearance["visualStyle"] | undefined,
    logoPosition: campaign?.logo_position as PortalAppearance["logoPosition"] | undefined,
    buttonText: campaign?.button_text ?? undefined,
    autoplayEnabled: campaign?.autoplay_enabled ?? undefined,
    showArrows: campaign?.show_arrows ?? undefined,
    showIndicators: campaign?.show_indicators ?? undefined,
    showProgressBar: campaign?.show_progress_bar ?? undefined,
    quickInfo: [campaign?.quick_info_1 ?? "", campaign?.quick_info_2 ?? "", campaign?.quick_info_3 ?? ""],
  });
}

export function toE164(countryCode: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${countryCode}${digits}`;
}

/** Operational day: before the daily reset time the period still belongs to the previous day. */
export function periodDateFor(dailyResetTime: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const [rh = "0", rm = "0"] = dailyResetTime.split(":");
  const resetMinutes = Number(rh) * 60 + Number(rm);
  if (minutes >= resetMinutes) return date;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function resolvePortalTarget(
  admin: AdminClient,
  slug: string,
): Promise<PortalTarget | null> {
  const clean = slug.trim().toLowerCase();

  // 1. Tentar resolver por Empresa (Matriz)
  const { data: company } = await admin
    .from("companies")
    .select("id, name, trade_name, legal_name, portal_slug, city, state, blocked, status, logo_url, portal_active")
    .eq("portal_slug", clean)
    .maybeSingle();

  if (company && !company.blocked && company.status === "ativa" && (company as any).portal_active !== false) {
    // Buscar campanha ativa específica para a Matriz (branch_id IS NULL e event_id IS NULL)
    const campaign = await admin
      .from("campaigns")
      .select(`id, name, description, logo_url, banner_urls, redirect_url, ${campaignAppearanceFields}`)
      .eq("company_id", company.id)
      .eq("status", "ativa")
      .is("branch_id", null)
      .is("event_id", null)
      .limit(1)
      .maybeSingle();

    const campaignData = campaign.data;

    // Identidade Visual: Campanha -> Matriz -> Manos Tech
    let logoPath = campaignData?.logo_url || company.logo_url;

    if (!logoPath) {
      const { data: pSettings } = await admin
        .from("platform_settings")
        .select("logo_url")
        .maybeSingle();
      logoPath =
        pSettings?.logo_url ||
        "https://id-preview--be97ad20-8aa3-4eb2-8466-ba2c053298e6.lovable.app/manos-tech-robot.png";
    }

    return {
      kind: "company",
      id: company.id,
      name: company.trade_name || company.name,
      companyId: company.id,
      companyName: company.trade_name || company.name,
      location: [company.city, company.state].filter(Boolean).join(" - ") || null,
      dailyResetTime: "06:00",
      campaignId: campaignData?.id ?? null,
      campaignName: campaignData?.name ?? null,
      campaignDescription: campaignData?.description ?? null,
      logoPath: logoPath,
      bannerPaths: campaignData?.banner_urls ?? [],
      redirectUrl: campaignData?.redirect_url ?? null,
      appearance: campaignAppearance(campaignData),
      sponsors: [],
    };
  }

  // 2. Tentar resolver por Filial
  const { data: branch } = await admin
    .from("branches")
    .select(
      "id, name, trade_name, legal_name, company_id, city, state, daily_reset_time, active, logo_url, is_headquarters, companies(name, trade_name, legal_name, blocked, status, logo_url)",
    )
    .eq("portal_slug", clean)
    .maybeSingle();

  if (branch && branch.active) {
    const companyData = branch.companies as unknown as {
      blocked: boolean;
      status: string;
      trade_name: string;
      name: string;
      logo_url: string | null;
    };
    if (!companyData || companyData.blocked || companyData.status !== "ativa") return null;

    const campaign = await activeCampaign(admin, { branchId: branch.id });

    let logoPath = campaign?.logo_url || branch.logo_url || companyData.logo_url;

    if (!logoPath) {
      const { data: pSettings } = await admin
        .from("platform_settings")
        .select("logo_url")
        .maybeSingle();
      logoPath =
        pSettings?.logo_url ||
        "https://id-preview--be97ad20-8aa3-4eb2-8466-ba2c053298e6.lovable.app/manos-tech-robot.png";
    }

    return {
      kind: "branch",
      id: branch.id,
      name: branch.trade_name || branch.name,
      companyId: branch.company_id,
      companyName: companyData.trade_name || companyData.name,
      location: [branch.city, branch.state].filter(Boolean).join(" - ") || null,
      dailyResetTime: branch.daily_reset_time,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      campaignDescription: campaign?.description ?? null,
      logoPath: logoPath,
      bannerPaths: campaign?.banner_urls ?? [],
      redirectUrl: campaign?.redirect_url ?? null,
      appearance: campaignAppearance(campaign),
      sponsors: [],
    };
  }

  const { data: event } = await admin
    .from("events")
    .select(
      "id, name, company_id, location, daily_reset_time, status, companies(name, trade_name, legal_name, blocked, status, logo_url)",
    )
    .eq("portal_slug", clean)
    .maybeSingle();

  if (event && (event.status === "ativo" || event.status === "planejado")) {
    const company = event.companies as {
      name: string;
      trade_name: string | null;
      legal_name: string | null;
      blocked: boolean;
      status: string;
      logo_url: string | null;
    } | null;

    if (!company || company.blocked || company.status !== "ativa") return null;
    const campaign = await activeCampaign(admin, { eventId: event.id });

    // Para eventos: Campanha -> Matriz (via branches com is_headquarters=true) -> Empresa -> Manos Tech
    let logoPath = campaign?.logo_url;

    if (!logoPath) {
      const { data: headquarter } = await admin
        .from("branches")
        .select("logo_url")
        .eq("company_id", event.company_id)
        .eq("is_headquarters", true)
        .maybeSingle();

      logoPath = headquarter?.logo_url || company.logo_url;
    }

    // Fallback final: Logo padrão da Manos Tech (robô)
    if (!logoPath) {
      const { data: pSettings } = await admin
        .from("platform_settings")
        .select("logo_url")
        .maybeSingle();
      logoPath =
        pSettings?.logo_url ||
        "https://id-preview--be97ad20-8aa3-4eb2-8466-ba2c053298e6.lovable.app/manos-tech-robot.png";
    }

    return {
      kind: "event",
      id: event.id,
      name: event.name,
      companyId: event.company_id,
      companyName: company.trade_name || company.name,
      location: event.location ?? null,
      dailyResetTime: event.daily_reset_time,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      campaignDescription: campaign?.description ?? null,
      logoPath: logoPath,
      bannerPaths: campaign?.banner_urls ?? [],
      redirectUrl: campaign?.redirect_url ?? null,
      appearance: campaignAppearance(campaign),
      sponsors: await eventSponsors(admin, campaign?.id),
    };
  }

  return null;
}

async function activeCampaign(admin: AdminClient, scope: { branchId?: string; eventId?: string }) {
  let query = admin
    .from("campaigns")
    .select(`id, name, description, logo_url, banner_urls, redirect_url, ${campaignAppearanceFields}`)
    .eq("status", "ativa")
    .limit(1);
  query = scope.branchId
    ? query.eq("branch_id", scope.branchId)
    : query.eq("event_id", scope.eventId!);
  const { data } = await query.maybeSingle();
  return data ?? null;
}

export async function registerLead(
  admin: AdminClient,
  target: PortalTarget,
  input: {
    fullName: string;
    email: string;
    countryCode: string;
    phone: string;
    city: string; // Obrigatória
    consent: boolean;
    deviceType?: string | undefined;
    userAgent?: string | undefined;
    mac?: string | undefined;
    ip?: string | undefined;
    apMac?: string | undefined;
    hotspotLogin?: string | undefined;
    hotspotLoginOnly?: string | undefined;
    hotspotOrig?: string | undefined;
    hotspotLinkOrig?: string | undefined;
  },
) {
  const phoneE164 = toE164(input.countryCode, input.phone);
  const now = new Date().toISOString();
  // O schema já exige consent === true. Não use um campo opcional enviado pelo
  // navegador para decidir o consentimento comercial, pois ele não existe na UI.
  const marketingConsent = input.consent;
  const periodDate = periodDateFor(target.dailyResetTime);

  // 1. Tentar encontrar visitante existente
  const { data: existingVisitor } = await admin
    .from("visitors")
    .select("id, connections_count")
    .eq("company_id", target.companyId)
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  let visitorId = existingVisitor?.id ?? null;
  let globalConnectionsCount = (existingVisitor?.connections_count ?? 0) + 1;

  // 2. Operação Atômica: Upsert Visitante + Registrar Conexão
  // Nota: Supabase não tem transação multi-tabela simples via client
  // Mas podemos garantir que se o visitante falhar, nada acontece.
  // E se o visitante ok, mas conexão falhar, o visitante já está lá (idempotência posterior ajuda).

  try {
    if (visitorId) {
      const { error: updateError } = await admin
        .from("visitors")
        .update({
          full_name: input.fullName,
          email: input.email,
          city: input.city,
          last_seen_at: now,
          connections_count: globalConnectionsCount,
          lgpd_consent: true,
          lgpd_consent_at: now,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? now : null,
          whatsapp_opt_in: marketingConsent,
          whatsapp_opt_in_at: marketingConsent ? now : null,
          consent_version: "wifi-and-whatsapp-v1",
        })
        .eq("id", visitorId);

      if (updateError) throw new Error(`Erro ao atualizar visitante: ${updateError.message}`);
    } else {
      const { data: created, error: insertError } = await admin
        .from("visitors")
        .insert({
          company_id: target.companyId,
          full_name: input.fullName,
          email: input.email,
          phone_e164: phoneE164,
          country_code: input.countryCode,
          city: input.city,
          lgpd_consent: true,
          lgpd_consent_at: now,
          marketing_consent: marketingConsent,
          marketing_consent_at: marketingConsent ? now : null,
          whatsapp_opt_in: marketingConsent,
          whatsapp_opt_in_at: marketingConsent ? now : null,
          consent_version: "wifi-and-whatsapp-v1",
          connections_count: 1,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(`Erro ao criar visitante: ${insertError.message}`);
      visitorId = created.id;
      globalConnectionsCount = 1;
    }

    // Cria ou atualiza o lead da campanha vigente sem alterar o link/QR do portal.
    // O mesmo visitante pode participar de campanhas diferentes, cada uma com seu próprio funil.
    const { error: leadError } = await admin.from("crm_leads").upsert(
      {
        company_id: target.companyId,
        campaign_id: target.campaignId,
        visitor_id: visitorId,
        source_branch_id: target.kind === "branch" ? target.id : null,
        source_event_id: target.kind === "event" ? target.id : null,
        whatsapp_opt_in: marketingConsent,
        whatsapp_opt_in_at: marketingConsent ? now : null,
        consent_version: "wifi-and-whatsapp-v1",
        updated_at: now,
      },
      { onConflict: "visitor_id,campaign_id" },
    );

    if (leadError) {
      console.error("[registerLead] Falha ao vincular lead à campanha:", leadError);
    }

    // Identificar se é um retorno: busca conexoes ja existentes antes desta operacao
    const { count } = await admin
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("company_id", target.companyId)
      .eq("visitor_id", visitorId);

    const isReturning = (count ?? 0) > 0;
    const localConnectionsCount = (count ?? 0) + 1;

    // 3. Idempotência da Conexão: Evitar duplicar no mesmo período se o usuário recarregar/repetir
    const { data: existingConn } = await (
      admin.from("connections") as unknown as {
        select: (c: string) => {
          eq: (
            k: string,
            v: unknown,
          ) => {
            eq: (
              k: string,
              v: unknown,
            ) => {
              eq: (
                k: string,
                v: unknown,
              ) => { maybeSingle: () => Promise<{ data: { id: string } | null }> };
            };
          };
        };
      }
    )
      .select("id")
      .eq("visitor_id", visitorId)
      .eq("period_date", periodDate)
      .eq("company_id", target.companyId)
      .maybeSingle();

    if (!existingConn) {
      const { error: connError } = await (
        admin.from("connections") as unknown as {
          insert: (d: unknown) => Promise<{ error: unknown }>;
        }
      ).insert({
        company_id: target.companyId,
        branch_id: target.kind === "branch" ? target.id : null,
        event_id: target.kind === "event" ? target.id : null,
        campaign_id: target.campaignId,
        visitor_id: visitorId!,
        device_type: input.deviceType || null,
        user_agent: input.userAgent || null,
        mac_address: input.mac || null,
        ip_address: input.ip || null,
        ap_mac: input.apMac || null,
        period_date: periodDate,
        is_returning: (count ?? 0) > 0,
      });
      if (connError)
        throw new Error(`Erro ao registrar conexão: ${(connError as { message: string }).message}`);
    }

    return {
      ok: true as const,
      isReturning,
      visitorId: visitorId!,
      connectionsCount: localConnectionsCount,
    };
  } catch (error: unknown) {
    console.error("[registerLead] Falha crítica:", error);
    throw error;
  }
}
