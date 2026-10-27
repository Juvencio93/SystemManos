import { describe, expect, it } from "vitest";
import {
  DESCRIBE_GENERIC_ERROR,
  DESCRIBE_MAX_ATTACHMENTS,
  DESCRIBE_MAX_STORED_ATTACHMENTS,
  DESCRIBE_QUOTA_LIMIT,
  describeAttachmentsToPrune,
  describeFailureLabel,
  describeQuotaStatus,
  splitDescribePromptParts,
  todaySaoPaulo,
  todayStartSaoPauloIso,
  validateDescribeAttachments,
} from "./banner-describe";

describe("describeQuotaStatus", () => {
  it("mostra 2 de 2 no início do dia", () => {
    expect(describeQuotaStatus(0)).toEqual({
      used: 0,
      limit: DESCRIBE_QUOTA_LIMIT,
      remaining: 2,
      exhausted: false,
    });
  });

  it("esgota no segundo uso", () => {
    expect(describeQuotaStatus(2).exhausted).toBe(true);
    expect(describeQuotaStatus(2).remaining).toBe(0);
  });

  it("nunca fica negativo", () => {
    expect(describeQuotaStatus(99).remaining).toBe(0);
    expect(describeQuotaStatus(-3).used).toBe(0);
  });
});

describe("validateDescribeAttachments", () => {
  it("aceita até 4 fotos válidas", () => {
    expect(
      validateDescribeAttachments([
        { mimeType: "image/jpeg", sizeChars: 500_000 },
        { mimeType: "image/png", sizeChars: 800_000 },
      ]),
    ).toEqual([]);
  });

  it("barra a 5ª foto", () => {
    const five = Array.from({ length: DESCRIBE_MAX_ATTACHMENTS + 1 }, () => ({
      mimeType: "image/jpeg",
      sizeChars: 100,
    }));
    expect(validateDescribeAttachments(five).length).toBeGreaterThan(0);
  });

  it("barra mime fora de foto e arquivo grande", () => {
    expect(
      validateDescribeAttachments([{ mimeType: "application/pdf", sizeChars: 100 }])
        .length,
    ).toBeGreaterThan(0);
    expect(
      validateDescribeAttachments([
        { mimeType: "image/jpeg", sizeChars: 9_999_999 },
      ]).length,
    ).toBeGreaterThan(0);
  });
});

describe("describeAttachmentsToPrune", () => {
  it("mantém as 10 mais recentes e lista o resto", () => {
    const rows = Array.from({ length: DESCRIBE_MAX_STORED_ATTACHMENTS + 3 }, (_, i) => ({
      id: `id-${i}`,
      createdAt: `2026-10-26T0${i}:00:00Z`,
    }));
    expect(describeAttachmentsToPrune(rows)).toEqual(["id-10", "id-11", "id-12"]);
  });

  it("não poda abaixo do teto", () => {
    expect(describeAttachmentsToPrune([{ id: "a", createdAt: "" }])).toEqual([]);
  });
});

describe("describeFailureLabel", () => {
  it("nunca expõe detalhe de provedor ao usuário", () => {
    expect(DESCRIBE_GENERIC_ERROR).not.toMatch(/gemini|crédit|429|chave/i);
  });

  it("rotula sem corpo de erro", () => {
    expect(describeFailureLabel("missing_key")).toMatch(/GEMINI_API_KEY/);
    expect(describeFailureLabel("http", 429)).toBe("API de imagem: HTTP 429");
    expect(describeFailureLabel("timeout")).toMatch(/timeout/);
  });
});

describe("splitDescribePromptParts", () => {
  it("separa RESUMO e PROMPT", () => {
    const parts = splitDescribePromptParts(
      "RESUMO: Festival de cucas toda quinta-feira por R$ 14,99.\nPROMPT: Foto publicitária de cucas \"FESTIVAL DE CUCAS\" \"R$ 14,99\".",
      "Festival de cucas",
    );
    expect(parts.summary).toContain("quinta-feira");
    expect(parts.imagePrompt).toContain("FESTIVAL DE CUCAS");
  });

  it("sem marcas, usa o texto todo como prompt", () => {
    const parts = splitDescribePromptParts("Foto de cucas.", "Festival");
    expect(parts.imagePrompt).toBe("Foto de cucas.");
    expect(parts.summary).toBe("Festival");
  });
});

describe("todaySaoPaulo", () => {
  it("usa o dia de São Paulo, não o UTC", () => {
    // 2026-10-27 01:00 UTC ainda é 2026-10-26 22:00 em SP.
    expect(todaySaoPaulo(new Date("2026-10-27T01:00:00Z"))).toBe("2026-10-26");
    expect(todayStartSaoPauloIso(new Date("2026-10-27T01:00:00Z"))).toBe(
      "2026-10-26T00:00:00-03:00",
    );
  });
});
