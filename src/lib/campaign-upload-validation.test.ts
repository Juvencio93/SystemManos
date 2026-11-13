import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_ASSET_ALLOWED_MIME_TYPES,
  CAMPAIGN_ASSET_MAX_BYTES,
  campaignAssetExtensionForMime,
  campaignAssetExtensionMatchesMime,
  isAllowedCampaignAssetMime,
  validateCampaignAssetClaim,
} from "./campaign-upload-validation";

const MB = 1024 * 1024;

describe("isAllowedCampaignAssetMime", () => {
  it("aceita só PNG, JPEG, WebP e MP4", () => {
    expect([...CAMPAIGN_ASSET_ALLOWED_MIME_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
    ]);
    for (const mime of ["image/png", "image/jpeg", "image/webp", "video/mp4"]) {
      expect(isAllowedCampaignAssetMime(mime)).toBe(true);
    }
  });

  it("barra HTML, SVG, GIF, EXE e PDF — os tipos do ataque da auditoria", () => {
    for (const mime of [
      "text/html",
      "image/svg+xml",
      "image/gif",
      "application/x-msdownload",
      "application/pdf",
      "application/octet-stream",
      "",
    ]) {
      expect(isAllowedCampaignAssetMime(mime)).toBe(false);
    }
  });
});

describe("validateCampaignAssetClaim", () => {
  it("aceita banner de 15 MB no limite e barra 15 MB + 1 byte", () => {
    expect(
      validateCampaignAssetClaim({ kind: "banner", mimeType: "image/webp", size: 15 * MB }),
    ).toBeNull();
    expect(
      validateCampaignAssetClaim({
        kind: "banner",
        mimeType: "image/webp",
        size: 15 * MB + 1,
      }),
    ).toMatch(/15 MB/);
  });

  it("barra logo acima de 5 MB e vídeo acima de 10 MB", () => {
    expect(
      validateCampaignAssetClaim({ kind: "logo", mimeType: "image/png", size: 5 * MB + 1 }),
    ).toMatch(/5 MB/);
    expect(
      validateCampaignAssetClaim({ kind: "video", mimeType: "video/mp4", size: 10 * MB + 1 }),
    ).toMatch(/10 MB/);
  });

  it("barra logo de patrocinador acima de 2 MB e banner acima de 3 MB", () => {
    expect(
      validateCampaignAssetClaim({
        kind: "sponsor-logo",
        mimeType: "image/png",
        size: 2 * MB + 1,
      }),
    ).toMatch(/2 MB/);
    expect(
      validateCampaignAssetClaim({
        kind: "sponsor-banner",
        mimeType: "image/png",
        size: 3 * MB + 1,
      }),
    ).toMatch(/3 MB/);
  });

  it("barra logo de empresa/filial acima de 10 MB", () => {
    expect(
      validateCampaignAssetClaim({
        kind: "company-logo",
        mimeType: "image/jpeg",
        size: 10 * MB + 1,
      }),
    ).toMatch(/10 MB/);
    expect(
      validateCampaignAssetClaim({
        kind: "branch-logo",
        mimeType: "image/jpeg",
        size: 10 * MB,
      }),
    ).toBeNull();
  });

  it("barra MIME fora da allowlist com mensagem em pt-BR", () => {
    const error = validateCampaignAssetClaim({
      kind: "logo",
      mimeType: "text/html",
      size: 100,
    });
    expect(error).toMatch(/não permitido/);
    expect(error).toMatch(/PNG, JPEG e WebP/);
  });

  it("barra vídeo com MIME de imagem e imagem com MIME de vídeo", () => {
    expect(
      validateCampaignAssetClaim({ kind: "video", mimeType: "image/png", size: 100 }),
    ).toMatch(/MP4/);
    expect(
      validateCampaignAssetClaim({ kind: "logo", mimeType: "video/mp4", size: 100 }),
    ).toMatch(/PNG, JPEG ou WebP/);
  });

  it("aceita vídeo de 10 s e barra vídeo de 11 s", () => {
    expect(
      validateCampaignAssetClaim({
        kind: "video",
        mimeType: "video/mp4",
        size: 5 * MB,
        durationSeconds: 10,
      }),
    ).toBeNull();
    expect(
      validateCampaignAssetClaim({
        kind: "video",
        mimeType: "video/mp4",
        size: 5 * MB,
        durationSeconds: 11,
      }),
    ).toMatch(/11 segundos/);
  });

  it("nunca deixa o teto do bucket passar de 15 MB", () => {
    expect(CAMPAIGN_ASSET_MAX_BYTES).toBe(15 * MB);
  });
});

describe("campaignAssetExtensionForMime / campaignAssetExtensionMatchesMime", () => {
  it("mapeia cada MIME para a extensão do caminho", () => {
    expect(campaignAssetExtensionForMime("image/png")).toBe("png");
    expect(campaignAssetExtensionForMime("image/jpeg")).toBe("jpg");
    expect(campaignAssetExtensionForMime("image/webp")).toBe("webp");
    expect(campaignAssetExtensionForMime("video/mp4")).toBe("mp4");
    expect(campaignAssetExtensionForMime("text/html")).toBeNull();
  });

  it("aceita jpg e jpeg para image/jpeg e barra extensão divergente", () => {
    expect(campaignAssetExtensionMatchesMime("abc.jpg", "image/jpeg")).toBe(true);
    expect(campaignAssetExtensionMatchesMime("abc.jpeg", "image/jpeg")).toBe(true);
    expect(campaignAssetExtensionMatchesMime("abc.png", "image/jpeg")).toBe(false);
    expect(campaignAssetExtensionMatchesMime("abc.mp4", "image/png")).toBe(false);
  });
});
