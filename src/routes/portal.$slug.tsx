import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  CheckCircle2,
  Loader2,
  Radar,
  ShieldCheck,
  Unlock,
  Wifi,
  ExternalLink,
  Instagram,
  Facebook,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeUrl, isSocialUrl } from "@/lib/url-utils";

import { BannerCarousel } from "@/components/app/banner-carousel";
import { SponsorsCarousel } from "@/components/app/sponsors-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries, defaultCountry } from "@/lib/countries";
import { getPortal, submitPortalLead } from "@/lib/portal.functions";
import { defaultPortalAppearance, type PortalAppearance } from "@/lib/campaign-appearance";
import { portalTheme } from "@/lib/portal-theme";
import { portalLayoutFor, portalLayoutMaxWidth } from "@/components/app/portal/portal-layouts";


export const Route = createFileRoute("/portal/$slug")({
  loader: ({ params }) => getPortal({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.companyName} | Wi-Fi Grátis`
      : "Portal Wi-Fi indisponivel | Manos Tech";
    const description = loaderData
      ? `Conecte-se gratuitamente ao Wi-Fi de ${loaderData.companyName}. Cadastro rápido com consentimento LGPD.`
      : "Este portal Wi-Fi não está disponível neste momento.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: () => <PortalUnavailable />,
  notFoundComponent: () => <PortalUnavailable />,
  component: PortalPage,
});

function PortalShell({
  children,
  maxWidth = "460px",
  appearance = defaultPortalAppearance,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  appearance?: PortalAppearance;
}) {
  const theme = portalTheme(appearance);

  return (
    <div
      className={`relative flex min-h-[100svh] flex-col items-center overflow-x-hidden text-foreground antialiased ${theme.typography.fontClass} ${theme.typography.shellPadClass} ${theme.typography.shellAlignClass} ${theme.rootClass}`}
      style={theme.rootStyle}
    >
      <div
        className="relative w-full animate-in fade-in slide-in-from-bottom-4 duration-1000"
        style={{ maxWidth }}
      >

        {children}
      </div>
    </div>
  );
}

function PortalUnavailable() {
  return (
    <PortalShell>
      <Card className="glass-panel border-primary/20 rounded-3xl">
        <CardContent className="space-y-3 p-8 text-center">
          <Radar className="mx-auto size-8 text-primary" />
          <h1 className="font-display text-lg font-semibold">Portal indisponivel</h1>
          <p className="text-sm text-muted-foreground">
            Este link de Wi-Fi não está ativo. Fale com a equipe do local para receber o endereço
            correto.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Conhecer a Manos Tech</Link>
          </Button>
        </CardContent>
      </Card>
    </PortalShell>
  );
}

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/mobi/.test(ua)) return "mobile";
  return "desktop";
}

function formatBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const FieldLabel = ({
  htmlFor,
  children,
  className = "",
}: {
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Label
    htmlFor={htmlFor}
    className={`ml-1 text-[color:var(--portal-text)] ${className}`}
  >
    {children}
  </Label>
);

function PortalPage() {
  const portal = Route.useLoaderData();
  const { slug } = Route.useParams();
  const submit = useServerFn(submitPortalLead);
  const [done, setDone] = useState<{ isReturning: boolean; connectionsCount: number; hotspotRedirectUrl?: string | null } | null>(null);
  const [countryKey, setCountryKey] = useState(`${defaultCountry.code}|${defaultCountry.name}`);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    city: "",
    consent: false,
  });

  const selectedCountry = useMemo(
    () => countries.find((c) => `${c.code}|${c.name}` === countryKey) ?? defaultCountry,
    [countryKey],
  );

  const isBrazil = selectedCountry.code === "+55";

  const mutation = useMutation({
    mutationFn: async () => {
      // Capture parameters from URL
      const searchParams = new URLSearchParams(window.location.search);
      const mac = searchParams.get("mac") || searchParams.get("client_mac");
      const ip = searchParams.get("ip") || searchParams.get("client_ip");
      const apMac = searchParams.get("ap_mac") || searchParams.get("called_station_id");
      const hotspotLogin = searchParams.get("link-login") || undefined;
      const hotspotLoginOnly = searchParams.get("link-login-only") || undefined;
      const hotspotOrig = searchParams.get("link-orig") || undefined;
      const hotspotLinkOrig = searchParams.get("link-orig-esc") || undefined;

      // Re-validate inside to be safe
      const digits = form.phone.replace(/\D/g, "");
      const ddiDigits = selectedCountry.code.replace(/\D/g, "");
      const cleanPhoneDigits = digits.startsWith(ddiDigits)
        ? digits.slice(ddiDigits.length)
        : digits;

      const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
      const isNameValid = form.fullName.trim().length >= 3;
      const isPhoneValid =
        cleanPhoneDigits.length >= 8 &&
        cleanPhoneDigits.length <= 15 &&
        !/^0+$/.test(cleanPhoneDigits);
      const isCityValid = form.city.trim().length >= 2;

      if (!isNameValid || !isEmailValid || !isPhoneValid || !isCityValid || !form.consent) {
        throw new Error("Por favor, preencha todos os campos corretamente");
      }

      return submit({
        data: {
          slug,
          fullName: form.fullName.trim(),
          phone: cleanPhoneDigits,
          email: form.email.trim(),
          city: form.city.trim(),
          countryCode: selectedCountry.code,
          consent: true,
          deviceType: detectDevice(navigator.userAgent),
          userAgent: navigator.userAgent.slice(0, 400),
          mac: mac || undefined,
          ip: ip || undefined,
          apMac: apMac || undefined,
          hotspotLogin,
          hotspotLoginOnly,
          hotspotOrig,
          hotspotLinkOrig,
        },
      });
    },
    onSuccess: (result) =>
      setDone({ isReturning: result.isReturning, connectionsCount: result.connectionsCount, hotspotRedirectUrl: result.hotspotReturnUrl }),
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.includes("violates") || msg.includes("foreign key") || msg.includes("duplicate")) {
        toast.error("Não foi possível processar seu cadastro. Verifique os dados.");
      } else {
        toast.error(msg);
      }
    },
  });

  const isFormValid = useMemo(() => {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    const isNameValid = form.fullName.trim().length >= 3;

    const digits = form.phone.replace(/\D/g, "");
    const ddiDigits = selectedCountry.code.replace(/\D/g, "");
    const cleanPhoneDigits = digits.startsWith(ddiDigits) ? digits.slice(ddiDigits.length) : digits;
    const isPhoneValid =
      cleanPhoneDigits.length >= 8 &&
      cleanPhoneDigits.length <= 15 &&
      !/^0+$/.test(cleanPhoneDigits);

    const isCityValid = form.city.trim().length >= 2;

    return (
      isNameValid &&
      isEmailValid &&
      isPhoneValid &&
      isCityValid &&
      form.consent &&
      !mutation.isPending
    );
  }, [form, selectedCountry, mutation.isPending]);

  if (!portal) return <PortalUnavailable />;

  if (done) {
    return <PortalSuccess portal={portal} done={done} />;
  }

  const theme = portalTheme(portal.appearance);
  const style = portal.appearance.visualStyle;
  const Layout = portalLayoutFor(style);

  const logoMaxClass =
    style === "vibrante"
      ? "max-h-[92px] max-w-[240px] lg:max-h-[120px] lg:max-w-[280px] max-sm:max-h-[72px]"
      : style === "elegante"
        ? "max-h-[70px] max-w-[200px] lg:max-h-[88px] max-sm:max-h-[58px]"
        : style === "minimalista"
          ? "max-h-[64px] max-w-[190px] lg:max-h-[76px] max-sm:max-h-[54px]"
          : "max-h-[72px] max-w-[210px] lg:max-h-[92px] max-sm:max-h-[60px]";

  const fieldSizeClass =
    style === "minimalista"
      ? "h-12 px-0 text-[15px]"
      : style === "elegante"
        ? "h-12 px-4 text-[14px] tracking-wide"
        : style === "vibrante"
          ? "h-12 px-4 text-[15px] font-semibold"
          : "h-11 px-4 text-sm";

  /* Posicionamento da logo/identidade — vale para todos os estilos, desktop e mobile. */
  const pos = portal.appearance.logoPosition;
  const identityAlignClass =
    pos === "right" ? "items-end text-right" : pos === "left" ? "items-start text-left" : "items-center text-center";
  const inlineAlignClass = pos === "right" ? "justify-end" : pos === "left" ? "justify-start" : "justify-center";

  const identity = (
    <div
      className={`flex flex-col ${
        style === "elegante" ? "gap-5 max-sm:gap-3" : style === "minimalista" ? "gap-4 max-sm:gap-3" : "gap-3 max-sm:gap-2"
      } ${identityAlignClass}`}
    >

      {portal.logoUrl ? (
        <img
          src={portal.logoUrl}
          alt={`Logo ${portal.companyName}`}
          className={`h-auto w-auto bg-transparent object-contain ${logoMaxClass}`}
        />
      ) : (
        <span
          className="font-display text-3xl font-black tracking-tight max-sm:text-2xl"
          style={{ color: theme.palette.accentOn }}
        >
          {(portal.companyName || portal.name).charAt(0)}
        </span>
      )}

      <div className="space-y-2 max-sm:space-y-1.5">
        <h1 className={`text-[color:var(--portal-text)] ${theme.typography.titleClass}`}>
          {portal.companyName || portal.name}
        </h1>
        <p
          className={`flex items-center gap-1.5 text-[color:var(--portal-muted)] ${theme.typography.subtitleClass} ${inlineAlignClass}`}
        >
          <Radar className="size-3.5" style={{ color: theme.palette.accentOn }} />
          {portal.location || "Unidade Manos Tech"}
        </p>
        {portal.campaignDescription && (
          <p className={`text-[color:var(--portal-text)] ${theme.typography.bodyClass}`}>
            {style === "elegante" ? `"${portal.campaignDescription}"` : portal.campaignDescription}
          </p>
        )}
      </div>
    </div>
  );



  const banner =
    portal.bannerUrls.length > 0 ? (
      <BannerCarousel
        urls={portal.bannerUrls}
        alt={`Banner de ${portal.companyName}`}
        appearance={portal.appearance}
      />
    ) : null;

  const quickInfoItems = portal.appearance.quickInfo.filter(Boolean);
  const quickInfo =
    quickInfoItems.length > 0 ? (
      <div
        className={
          style === "minimalista"
            ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
            : style === "vibrante"
              ? "flex flex-wrap justify-center gap-2 lg:justify-start"
              : "grid gap-2 sm:grid-cols-3"
        }
      >
        {quickInfoItems.map((info) =>
          style === "minimalista" ? (
            <span key={info} className="text-xs text-[color:var(--portal-muted)]">
              {info}
            </span>
          ) : (
            <div
              key={info}
              className={`${theme.panelClass} px-3 py-2 text-center text-xs text-[color:var(--portal-text)] ${
                style === "vibrante" ? "font-bold uppercase tracking-wide" : ""
              }`}
              style={theme.panelStyle}
            >
              {info}
            </div>
          ),
        )}
      </div>
    ) : null;

  const sponsors =
    portal.kind === "event" && portal.sponsors.length > 0 ? (
      <SponsorsCarousel sponsors={portal.sponsors} appearance={portal.appearance} />
    ) : null;

  const footer = (
    <div className="flex flex-col items-center space-y-1 pb-8 text-center opacity-60">
      <p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-widest text-[color:var(--portal-faint)]">
        <ShieldCheck className="size-3" style={{ color: theme.palette.accentOn }} />
        Navegação segura e criptografada
      </p>
      <p className="text-[10px] text-[color:var(--portal-faint)]">
        Tecnologia <span className="font-semibold">Manos Tech</span>
      </p>
    </div>
  );

  const formNode = (
    <form
      className={style === "minimalista" ? "space-y-6 max-sm:space-y-5" : "space-y-5 max-sm:space-y-3"}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className={style === "minimalista" ? "grid gap-5 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="fullName" className={theme.labelClass}>Nome completo *</FieldLabel>
                    <Input
                      id="fullName"
                      required
                      autoComplete="name"
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Ex: João Silva"
                      className={`${fieldSizeClass} transition-all placeholder:text-[color:var(--portal-faint)] ${theme.inputClass}`}
                      style={theme.inputStyle}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="email" className={theme.labelClass}>E-mail *</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className={`${fieldSizeClass} transition-all placeholder:text-[color:var(--portal-faint)] ${theme.inputClass}`}
                      style={theme.inputStyle}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="phone" className={theme.labelClass}>WhatsApp *</FieldLabel>
                    <div className="flex items-stretch gap-2">
                      <Select value={countryKey} onValueChange={setCountryKey}>
                        <SelectTrigger
                          className={`portal-country-trigger ${fieldSizeClass} w-[116px] shrink-0 justify-between gap-1 sm:w-[128px] ${theme.inputClass}`}
                          style={theme.inputStyle}
                          aria-label="País"
                        >
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-base leading-none">{selectedCountry.flag}</span>
                            <span className="text-xs font-medium">{selectedCountry.code}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent
                          position="popper"
                          sideOffset={6}
                          className={`portal-select-content ${theme.rootClass} ${theme.typography.fontClass}`}
                          style={{
                            ...theme.rootStyle,
                            background: theme.palette.surface,
                            borderColor: theme.palette.border,
                            color: theme.palette.text,
                          }}
                        >
                          {countries.map((country) => (
                            <SelectItem
                              key={`${country.code}|${country.name}`}
                              value={`${country.code}|${country.name}`}
                              className="text-[color:var(--portal-text)]"
                            >
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                <span className="text-base leading-none">{country.flag}</span>
                                <span className="text-xs font-medium">{country.code}</span>
                                <span className="hidden text-[11px] text-[color:var(--portal-muted)] sm:inline">
                                  {country.name}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.phone}
                        maxLength={isBrazil ? 15 : 24}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phone: isBrazil ? formatBrazilPhone(e.target.value) : e.target.value.replace(/[^\d\s()+.-]/g, ""),
                          }))
                        }
                        placeholder={isBrazil ? "(00) 00000-0000" : "Número"}
                        className={`${fieldSizeClass} flex-1 transition-all placeholder:text-[color:var(--portal-faint)] ${theme.inputClass}`}
                        style={theme.inputStyle}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel htmlFor="city" className={theme.labelClass}>Cidade *</FieldLabel>
                    <Input
                      id="city"
                      required
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      placeholder="Sua cidade atual"
                      className={`${fieldSizeClass} transition-all placeholder:text-[color:var(--portal-faint)] ${theme.inputClass}`}
                      style={theme.inputStyle}
                    />
                  </div>
                </div>

                {/* LGPD: cada linguagem visual apresenta o consentimento de forma própria. */}
                <div
                  className={
                    style === "minimalista"
                      ? "space-y-3 border-t border-[color:var(--portal-border)] pt-4"
                      : style === "elegante"
                        ? "space-y-3 px-1 py-2 text-center"
                        : `space-y-2 p-3 ${theme.panelClass}`
                  }
                  style={style === "minimalista" || style === "elegante" ? undefined : theme.panelStyle}
                >
                  <div className="space-y-1">
                    {style === "minimalista" ? (
                      <p className={`text-[color:var(--portal-muted)] ${theme.labelClass}`}>
                        Privacidade
                      </p>
                    ) : style === "elegante" ? (
                      <p
                        className="text-[10px] font-medium uppercase tracking-[0.32em]"
                        style={{ color: theme.palette.accentOn }}
                      >
                        Privacidade e consentimento
                      </p>
                    ) : (
                      <p className="text-xs font-semibold leading-snug text-[color:var(--portal-text)] sm:text-sm">
                        <span
                          className="font-bold uppercase tracking-wider"
                          style={{ color: theme.palette.accentOn }}
                        >
                          LGPD
                        </span>
                        <span className="text-[color:var(--portal-text)]"> — Lei Geral de Proteção de Dados</span>
                      </p>
                    )}
                    <p className={`text-[color:var(--portal-muted)] ${theme.typography.lgpdClass}`}>
                      Seus dados serão usados para liberar o acesso ao Wi-Fi e para o envio de
                      ofertas e contatos comerciais desta empresa pelo WhatsApp. Você pode pedir
                      a exclusão ou interromper os contatos a qualquer momento.
                    </p>
                  </div>
                  <label
                    htmlFor="consent"
                    className={`flex cursor-pointer items-start gap-2.5 ${
                      style === "elegante"
                        ? "justify-center pt-1 text-left"
                        : style === "minimalista"
                          ? "pt-1"
                          : "border-t border-[color:var(--portal-border)] pt-2"
                    }`}
                  >
                    <input
                      id="consent"
                      type="checkbox"
                      checked={form.consent}
                      onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
                      className="mt-1 size-4 shrink-0 rounded border-[color:var(--portal-border)] bg-[color:var(--portal-surface-alt)] transition-all focus:ring-offset-transparent"
                      style={{ accentColor: theme.palette.accentOn }}
                    />
                    <span className={`text-[color:var(--portal-muted)] ${theme.typography.lgpdClass}`}>
                      <strong className="text-[color:var(--portal-text)]">Obrigatório:</strong> aceito os termos de
                      uso e o tratamento dos meus dados conforme a LGPD para liberar o Wi-Fi e
                      autorizo o recebimento de ofertas e contatos comerciais desta empresa pelo
                      WhatsApp.
                    </span>
                  </label>
                </div>


      <Button
        type="submit"
        size="default"
        className={`z-10 w-full border-0 transition-all hover:brightness-[1.08] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-100 ${
          style === "vibrante"
            ? "h-16 text-lg max-sm:h-14"
            : style === "minimalista"
              ? "h-14 text-[12px]"
              : style === "elegante"
                ? "h-14 text-[12px]"
                : "h-12 text-sm max-sm:sticky max-sm:bottom-2"
        } ${theme.buttonClass}`}
        style={!isFormValid || mutation.isPending ? theme.buttonDisabledStyle : theme.buttonStyle}
        disabled={!isFormValid || mutation.isPending}
      >
        {mutation.isPending ? (
          <div className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span>Conectando...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Wifi className="size-5" />
            <span>{portal.appearance.buttonText}</span>
          </div>
        )}
      </Button>
    </form>
  );

  return (
    <PortalShell maxWidth={portalLayoutMaxWidth[style]} appearance={portal.appearance}>
      <Layout
        theme={theme}
        identity={identity}
        banner={banner}
        quickInfo={quickInfo}
        form={formNode}
        sponsors={sponsors}
        footer={footer}
      />
    </PortalShell>
  );
}



function PortalSuccess({
  portal,
  done,
}: {
  portal: NonNullable<ReturnType<typeof Route.useLoaderData>>;
  done: { connectionsCount: number };
}) {
  const sameName = portal.name.toLowerCase() === portal.companyName.toLowerCase();
  const finalRedirectUrl = useMemo(() => normalizeUrl(portal.redirectUrl), [portal.redirectUrl]);
  const isSocial = useMemo(() => isSocialUrl(finalRedirectUrl), [finalRedirectUrl]);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Detect if we are inside an iframe
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  useEffect(() => {
    if (!finalRedirectUrl || isInIframe) return;

    const timer = setTimeout(() => {
      // Use window.location.replace to prevent back-button loops and handle same-tab navigation
      window.location.replace(finalRedirectUrl);
    }, 3000);

    return () => clearTimeout(timer);
  }, [finalRedirectUrl, isInIframe]);

  const theme = portalTheme(portal.appearance);

  return (
    <PortalShell appearance={portal.appearance}>
      <Card className={`overflow-hidden ${theme.cardClass}`} style={theme.cardStyle}>
        <CardContent className="space-y-6 p-10 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <CheckCircle2 className="size-10 text-primary" />
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-4xl font-bold tracking-tight text-white">
              Conectado!
            </h1>
            <p className="text-sm leading-relaxed text-[color:var(--portal-muted)]">
              Que bom ter você por aqui. Seu acesso à internet já está liberado.
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--portal-border)] bg-[color:var(--portal-surface-alt)] p-5 backdrop-blur-sm">
            <p className="text-base font-bold text-white">
              {sameName ? portal.companyName : portal.name}
            </p>
            {!sameName && (
              <p className="mt-0.5 text-xs font-medium text-[color:var(--portal-muted)]">{portal.companyName}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <div className="size-1.5 animate-pulse rounded-full bg-primary" />
            {done.connectionsCount === 1
              ? "Primeiro acesso registrado."
              : `Este é o seu ${done.connectionsCount}º acesso aqui.`}
          </div>

          {finalRedirectUrl && (
            <div className="space-y-4 pt-4">
              {!isInIframe && (
                <div className="flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-widest text-[color:var(--portal-muted)]">
                  Redirecionando...
                </div>
              )}

              {isInIframe && (
                <div className="rounded-lg bg-primary/5 p-3 text-xs text-[color:var(--portal-muted)]">
                  O{" "}
                  {isSocial
                    ? finalRedirectUrl.includes("instagram.com")
                      ? "Instagram"
                      : "Facebook"
                    : "site"}{" "}
                  não permite abertura automática dentro desta visualização. Clique abaixo para
                  continuar.
                </div>
              )}

              <Button
                asChild
                variant="outline"
                className="h-12 w-full gap-2 border-[color:var(--portal-border)] bg-white/5 text-white transition-all hover:bg-white/10"
              >
                <a href={finalRedirectUrl} target="_blank" rel="noopener noreferrer">
                  {isSocial ? (
                    finalRedirectUrl.includes("instagram.com") ? (
                      <Instagram className="size-4 text-[#E4405F]" />
                    ) : (
                      <Facebook className="size-4 text-[#1877F2]" />
                    )
                  ) : (
                    <ExternalLink className="size-4 text-primary" />
                  )}
                  <span>
                    Continuar para{" "}
                    {isSocial
                      ? finalRedirectUrl.includes("instagram.com")
                        ? "Instagram"
                        : "Facebook"
                      : "Site"}
                  </span>
                  <ExternalLink className="size-3 opacity-50" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col items-center space-y-2 pb-10">
        <p className="text-[11px] text-[color:var(--portal-muted)]">
          Tecnologia <span className="font-bold text-[color:var(--portal-muted)]">Manos Tech</span>
        </p>
      </div>
    </PortalShell>
  );
}
