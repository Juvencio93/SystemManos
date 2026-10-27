import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { CampaignPortalPreview } from "@/components/app/campaign-portal-preview";
import {
  portalVisualStyles,
  type PortalAppearance,
  type PortalVisualStyle,
} from "@/lib/campaign-appearance";
import { cn } from "@/lib/utils";

const STYLE_META: Record<PortalVisualStyle, { nome: string; descricao: string }> = {
  moderno: {
    nome: "Moderno",
    descricao: "Cards flutuantes, cantos amplos e botão principal em destaque.",
  },
  elegante: {
    nome: "Elegante",
    descricao: "Contornos finos, cantos discretos e espaços amplos.",
  },
  minimalista: {
    nome: "Minimalista",
    descricao: "Sem caixas pesadas; campos com linha inferior e leitura limpa.",
  },
  vibrante: {
    nome: "Vibrante",
    descricao: "Herói em gradiente da marca e painel de conversão destacado.",
  },
};

/** Largura interna da miniatura (o preview é renderizado grande e reduzido via scale). */
const THUMB_INNER_WIDTH = 1100;
const THUMB_HEIGHT = 232;

/**
 * Miniatura viva do portal: renderiza o CampaignPortalPreview real em tamanho
 * grande e reduz com transform, dentro de uma janela de altura fixa.
 * Sem autoplay e sem pointer events — é só uma amostra visual.
 */
function StyleThumb({
  appearance,
  style,
  companyName,
  callout,
  logoUrl,
  bannerUrls,
}: {
  appearance: PortalAppearance;
  style: PortalVisualStyle;
  companyName: string;
  callout: string;
  logoUrl?: string | null | undefined;
  bannerUrls: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = width > 0 ? width / THUMB_INNER_WIDTH : 0;

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-black/50"
      style={{ height: THUMB_HEIGHT }}
    >
      {scale > 0 && (
        <div
          aria-hidden
          style={{
            width: THUMB_INNER_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        >
          <CampaignPortalPreview
            appearance={{ ...appearance, visualStyle: style, autoplayEnabled: false }}
            companyName={companyName}
            callout={callout}
            logoUrl={logoUrl}
            bannerUrls={bannerUrls}
            mode="desktop"
          />
        </div>
      )}
    </div>
  );
}

interface StylePickerCardsProps {
  appearance: PortalAppearance;
  value: PortalVisualStyle;
  onChange: (style: PortalVisualStyle) => void;
  companyName: string;
  callout: string;
  logoUrl?: string | null | undefined;
  bannerUrls: string[];
}

/**
 * Seletor visual dos 4 modelos de layout do portal. Substitui o dropdown de
 * texto: o usuário compara as miniaturas ao vivo (nas cores da campanha) e
 * clica para escolher — sem precisar selecionar no escuro e rolar até a prévia.
 */
export function StylePickerCards({
  appearance,
  value,
  onChange,
  companyName,
  callout,
  logoUrl,
  bannerUrls,
}: StylePickerCardsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Estilo visual do portal"
      className="grid gap-3 sm:grid-cols-2"
    >
      {portalVisualStyles.map((style) => {
        const selected = value === style;
        const meta = STYLE_META[style];
        return (
          <div
            key={style}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onChange(style)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange(style);
              }
            }}
            className={cn(
              "group cursor-pointer overflow-hidden rounded-2xl border-2 bg-muted/10 transition-all",
              "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]"
                : "border-border hover:border-primary/50 hover:bg-muted/20",
            )}
          >
            <StyleThumb
              appearance={appearance}
              style={style}
              companyName={companyName}
              callout={callout}
              logoUrl={logoUrl}
              bannerUrls={bannerUrls}
            />
            <div className="flex items-start gap-3 p-3.5">
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 text-transparent",
                )}
                aria-hidden
              >
                <Check className="size-3.5" strokeWidth={3.5} />
              </span>
              <span>
                <span className="block text-sm font-bold">{meta.nome}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {meta.descricao}
                </span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
