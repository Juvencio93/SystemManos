import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultPortalAppearance, type PortalAppearance } from "@/lib/campaign-appearance";
import { isRenderableSponsor, type PortalSponsor } from "@/lib/campaign-sponsors";
import { portalTheme } from "@/lib/portal-theme";

const autoplayMs = 7000;

/**
 * "Patrocinadores e apoiadores": carrossel independente do carrossel principal
 * da campanha. Swipe nativo no celular, autoplay lento e indicadores discretos.
 */
export function SponsorsCarousel({
  sponsors,
  appearance = defaultPortalAppearance,
  compact = false,
}: {
  sponsors: PortalSponsor[];
  appearance?: PortalAppearance;
  compact?: boolean;
}) {
  const items = useMemo(() => sponsors.filter(isRenderableSponsor), [sponsors]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const total = Math.max(1, Math.round(el.scrollWidth / Math.max(1, el.clientWidth)));
    setPages(total);
    setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, items.length]);

  const goTo = useCallback((next: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!appearance.autoplayEnabled || pages < 2) return;
    const timer = window.setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const current = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      goTo((current + 1) % pages);
    }, autoplayMs);
    return () => window.clearInterval(timer);
  }, [appearance.autoplayEnabled, goTo, pages]);

  if (items.length === 0) return null;

  const theme = portalTheme(appearance);

  return (
    <section
      aria-label="Patrocinadores e apoiadores"
      className={compact ? "space-y-1.5" : "space-y-2"}
    >
      <p
        className={`text-center font-medium uppercase tracking-[.18em] text-[color:var(--portal-muted)] ${compact ? "text-[8px]" : "text-[10px]"}`}
      >
        Patrocinadores e apoiadores
      </p>

      <div
        ref={trackRef}
        onScroll={() => {
          const el = trackRef.current;
          if (!el) return;
          setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((sponsor) => {
          const isBanner = sponsor.displayType === "banner";
          const media = isBanner ? (
            <div className="aspect-[4/1] w-full overflow-hidden">
              <img
                src={sponsor.bannerUrl ?? ""}
                alt={`Mini banner de ${sponsor.name}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`grid w-full place-items-center ${compact ? "h-10 p-1.5" : "h-16 p-2.5"}`}
            >
              <img
                src={sponsor.logoUrl ?? ""}
                alt={`Logo de ${sponsor.name}`}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          );

          const frame = (
            <div
              className={`overflow-hidden bg-[color:var(--portal-surface-alt)] ${theme.panelClass}`}
              style={theme.panelStyle}
              title={sponsor.name}
            >
              {media}
            </div>
          );

          return (
            <div
              key={sponsor.id}
              className={`shrink-0 snap-start ${isBanner ? "basis-full" : "basis-1/2 sm:basis-1/3"}`}
            >
              {sponsor.linkUrl ? (
                <a
                  href={sponsor.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={`Abrir site de ${sponsor.name}`}
                  className="block transition-opacity hover:opacity-90"
                >
                  {frame}
                </a>
              ) : (
                frame
              )}
            </div>
          );
        })}
      </div>

      {pages > 1 && appearance.showIndicators && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: pages }).map((_, index) => (
            <button
              key={`sponsor-page-${index}`}
              type="button"
              aria-label={`Ver patrocinadores ${index + 1}`}
              aria-current={index === page}
              onClick={() => goTo(index)}
              className="h-1 rounded-full transition-all"
              style={{
                width: index === page ? "1rem" : "0.25rem",
                backgroundColor:
                  index === page ? theme.palette.indicator : `${theme.palette.faint}66`,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
