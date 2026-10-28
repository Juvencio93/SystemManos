import { describe, expect, it } from "vitest";
import { extractCampaignAssetPath } from "./company-delete";

describe("extractCampaignAssetPath", () => {
  it("extrai o caminho de URL assinada da logo", () => {
    expect(
      extractCampaignAssetPath(
        "https://xyz.supabase.co/storage/v1/object/sign/campaign-assets/users/u1/company-logos/a1b2.png?token=eyJhbGciOiJIUzI1NiJ9",
      ),
    ).toBe("users/u1/company-logos/a1b2.png");
  });
  it("extrai o caminho de URL pública", () => {
    expect(
      extractCampaignAssetPath(
        "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/banner-describe/c1/foto.jpg",
      ),
    ).toBe("banner-describe/c1/foto.jpg");
  });
  it("ignora fragmento e decodifica o caminho", () => {
    expect(
      extractCampaignAssetPath(
        "https://xyz.supabase.co/storage/v1/object/sign/campaign-assets/users/u1/company-logos/minha%20logo.png?token=x#parte",
      ),
    ).toBe("users/u1/company-logos/minha logo.png");
  });
  it("devolve null para nulo, vazio e outro bucket", () => {
    expect(extractCampaignAssetPath(null)).toBe(null);
    expect(extractCampaignAssetPath("")).toBe(null);
    expect(
      extractCampaignAssetPath(
        "https://xyz.supabase.co/storage/v1/object/public/outro-bucket/arquivo.png",
      ),
    ).toBe(null);
    expect(
      extractCampaignAssetPath(
        "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/",
      ),
    ).toBe(null);
  });
});
