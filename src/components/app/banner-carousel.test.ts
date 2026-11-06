import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { BannerCarousel } from "./banner-carousel";

// Vídeo do banner do Boteco (4MB): desde 06/11 (decisão do Gabriel) a
// demonstração renderiza o vídeo como o portal real — o mockup volta a
// baixar o .mp4. O formulário continua aparecendo rápido porque o overlay
// "Carregando portal…" some no readyState interactive (PR #189).
const VIDEO_URL =
  "https://example.supabase.co/storage/v1/object/public/banners/56a83de7-video.mp4";
const POSTER_URL =
  "https://example.supabase.co/storage/v1/object/public/banners/56a83de7-video.jpg";

describe("BannerCarousel em demonstração (demoMode)", () => {
  it("na demonstração o vídeo é renderizado como no portal real", () => {
    const html = renderToString(
      createElement(BannerCarousel, {
        urls: [VIDEO_URL],
        alt: "Banner",
        demoMode: true,
      }),
    );
    expect(html).toContain("<video");
    expect(html).toContain(VIDEO_URL);
    expect(html).toContain(POSTER_URL);
  });

  it("no portal real o vídeo continua sendo renderizado", () => {
    const html = renderToString(
      createElement(BannerCarousel, { urls: [VIDEO_URL], alt: "Banner" }),
    );
    expect(html).toContain("<video");
    expect(html).toContain(VIDEO_URL);
    expect(html).toContain(POSTER_URL);
  });
});
