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

// Nota: o timeout de segurança do slide de vídeo (avança após ~4s se o vídeo
// continuar pausado, e o teto absoluto de ~15s) vive num useEffect e não é
// coberto por estes testes — efeitos não rodam em renderToString e o ambiente
// de teste aqui é node (sem DOM). Cobri-lo exigiria @testing-library/react +
// jsdom, que o projeto não tem.
