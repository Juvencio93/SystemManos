import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { defaultPortalAppearance, type PortalAppearance } from "@/lib/campaign-appearance";
import { portalTheme } from "@/lib/portal-theme";

const intervalMs = 5500;

export function BannerCarousel({
  urls,
  alt,
  appearance = defaultPortalAppearance,
}: {
  urls: string[];
  alt: string;
  appearance?: PortalAppearance;
}) {
  const [index, setIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const touchStart = useRef<number | null>(null);

  const select = useCallback(
    (next: number) => {
      setIndex((next + urls.length) % urls.length);
      setProgressKey((current) => current + 1);
    },
    [urls.length],
  );

  useEffect(() => {
    if (!appearance.autoplayEnabled || urls.length < 2) return;
    const timer = window.setInterval(() => select(index + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [appearance.autoplayEnabled, index, select, urls.length]);

  useEffect(() => {
    if (index >= urls.length) setIndex(0);
  }, [index, urls.length]);

  if (urls.length === 0) return null;

  const hasNavigation = urls.length > 1;
  const theme = portalTheme(appearance);
  const progressStyle = {
    animationDuration: `${intervalMs}ms`,
    backgroundColor: theme.palette.indicator,
  };

  return (
    <section className="space-y-3" aria-label="Banners da campanha">
      <div
        className={`group relative overflow-hidden bg-[color:var(--portal-surface-alt)] ${theme.bannerClass}`}
        style={theme.bannerStyle}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const end = event.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start === null || end === undefined || Math.abs(start - end) < 42) return;
          select(index + (start > end ? 1 : -1));
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {urls.map((url, currentIndex) => (
            <div key={`${url}-${currentIndex}`} className="relative aspect-[16/9] w-full shrink-0">
              <img
                src={url}
                alt={currentIndex === index ? alt : ""}
                loading={currentIndex === 0 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
            </div>
          ))}
        </div>

        {hasNavigation && appearance.showArrows && (
          <>
            <button
              type="button"
              aria-label="Banner anterior"
              onClick={() => select(index - 1)}
              className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--portal-border)] bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Próximo banner"
              onClick={() => select(index + 1)}
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--portal-border)] bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}

        {hasNavigation && appearance.showProgressBar && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
            <div
              key={progressKey}
              className={appearance.autoplayEnabled ? "h-full origin-left animate-[portal-progress_linear_forwards]" : "h-full w-full"}
              style={progressStyle}
            />
          </div>
        )}
      </div>

      {hasNavigation && appearance.showIndicators && (
        <div className="flex items-center justify-center gap-1.5" aria-label="Selecionar banner">
          {urls.map((url, currentIndex) => (
            <button
              key={`indicator-${url}-${currentIndex}`}
              type="button"
              aria-label={`Ver banner ${currentIndex + 1}`}
              aria-current={currentIndex === index}
              onClick={() => select(currentIndex)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: currentIndex === index ? "1.5rem" : "0.375rem",
                backgroundColor:
                  currentIndex === index ? theme.palette.indicator : `${theme.palette.faint}80`,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
