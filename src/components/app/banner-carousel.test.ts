import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { BannerCarousel } from "./banner-carousel";

// Vídeo do banner do Boteco (4MB): em demonstração o .mp4 não pode nem ser
// requisitado — o slide vira a foto de capa (.jpg), que já existe.
const VIDEO_URL =
  "https://example.supabase.co/storage/v1/object/public/banners/56a83de7-video.mp4";
const POSTER_URL =
  "https://example.supabase.co/storage/v1/object/public/banners/56a83de7-video.jpg";

describe("BannerCarousel em demonstração (demoMode)", () => {
  it("não renderiza <video> para banner de vídeo: usa a foto de capa (.jpg)", () => {
    const html = renderToString(
      createElement(BannerCarousel, {
        urls: [VIDEO_URL],
        alt: "Banner",
        demoMode: true,
      }),
    );
    expect(html).not.toContain("<video");
    expect(html).not.toContain(".mp4");
    expect(html).toContain("<img");
    expect(html).toContain(POSTER_URL);
  });

  it("no portal real o vídeo continua sendo renderizado", () => {
    const html = renderToString(
      createElement(BannerCarousel, { urls: [VIDEO_URL], alt: "Banner" }),
    );
    expect(html).toContain("<video");
    expect(html).toContain(VIDEO_URL);
  });
});
