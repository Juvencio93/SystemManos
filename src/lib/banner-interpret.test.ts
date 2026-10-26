import { describe, expect, it } from "vitest";
import {
  groundInterpretation,
  interpretBannerBrief,
  isFactContaminatedSubject,
  mergeInterpretedBrief,
  parseBannerInterpretation,
} from "./banner-interpret";

const SHORT_MESSAGES = [
  "Festival de cucas",
  "toda quarta feira, valor de 14,99 válidos para o mês de novembro",
];

describe("interpretação da conversa pela IA", () => {
  it("lê JSON puro e JSON em bloco cercado", () => {
    expect(
      parseBannerInterpretation('{"subject": "festival de cucas", "price": 14.99}'),
    ).toMatchObject({ subject: "festival de cucas", price: 14.99 });
    expect(
      parseBannerInterpretation(
        'Aqui está:\n```json\n{"subject": "festival de cucas"}\n```',
      ),
    ).toMatchObject({ subject: "festival de cucas" });
    expect(parseBannerInterpretation("não é json")).toBeNull();
    expect(parseBannerInterpretation('{"subject": "x", "price": "14,99"}')).toBeNull();
  });

  it("detecta assunto contaminado por fatos", () => {
    expect(
      isFactContaminatedSubject(
        "toda quarta feira, valor de 14,99 válidos para o mês de novembro",
      ),
    ).toBe(true);
    expect(isFactContaminatedSubject("Cucas diversos sabores por 14,99")).toBe(true);
    expect(isFactContaminatedSubject("festival de cucas")).toBe(false);
    expect(isFactContaminatedSubject(undefined)).toBe(false);
  });

  it("só aceita fatos com lastro nas mensagens", () => {
    const grounded = groundInterpretation(
      {
        subject: "festival de cucas",
        items: ["festival de cucas"],
        price: 14.99,
        weekday: "quarta-feira",
        validity: "mês de novembro",
      },
      SHORT_MESSAGES,
    );
    expect(grounded).toMatchObject({
      subject: "festival de cucas",
      items: ["festival de cucas"],
      price: 14.99,
      weekday: "quarta-feira",
      validity: "mês de novembro",
    });
    const invented = groundInterpretation(
      { subject: "pão francês", items: ["pão de queijo"], price: 19.99 },
      SHORT_MESSAGES,
    );
    expect(invented).toEqual({});
  });

  it("a IA assume assunto contaminado; o determinístico vence o resto", () => {
    const merged = mergeInterpretedBrief(
      {
        subject: "toda quarta feira, valor de 14,99 válidos para o mês de novembro",
        offerItems: [
          "toda quarta feira",
          "valor de 14,99 válidos para o mês de novembro",
        ],
        price: 14.99,
      },
      { subject: "festival de cucas", items: ["festival de cucas"], price: 19.99 },
    );
    expect(merged.subject).toBe("festival de cucas");
    expect(merged.offerItems).toEqual(["festival de cucas"]);
    expect(merged.price).toBe(14.99);
  });

  it("assunto determinístico limpo não é substituído; lacuna é preenchida", () => {
    const merged = mergeInterpretedBrief(
      { subject: "festival de cucas", offerItems: ["festival de cucas"] },
      { subject: "cucas", price: 14.99, weekday: "quarta-feira" },
    );
    expect(merged.subject).toBe("festival de cucas");
    expect(merged.offerItems).toEqual(["festival de cucas"]);
    expect(merged.price).toBe(14.99);
    expect(merged.weekday).toBe("quarta-feira");
    expect(merged.weekdays).toEqual(["quarta-feira"]);
  });

  it("falha do gateway ou JSON inválido devolve null (fallback determinístico)", async () => {
    const failing = () => Promise.resolve({ ok: false, text: null });
    await expect(
      interpretBannerBrief(SHORT_MESSAGES, { subject: "festival de cucas" }, failing),
    ).resolves.toBeNull();
    const garbage = () => Promise.resolve({ ok: true, text: "sem json aqui" });
    await expect(
      interpretBannerBrief(SHORT_MESSAGES, { subject: "festival de cucas" }, garbage),
    ).resolves.toBeNull();
  });

  it("interpretação válida funde o brief da conversa curta", async () => {
    const fakeCall = () =>
      Promise.resolve({
        ok: true,
        text: JSON.stringify({
          subject: "festival de cucas",
          items: ["festival de cucas"],
          price: 14.99,
          weekday: "quarta-feira",
          validity: "mês de novembro",
        }),
      });
    const merged = await interpretBannerBrief(
      SHORT_MESSAGES,
      {
        subject: "toda quarta feira, valor de 14,99 válidos para o mês de novembro",
        offerItems: [
          "toda quarta feira",
          "valor de 14,99 válidos para o mês de novembro",
        ],
      },
      fakeCall,
    );
    expect(merged).toMatchObject({
      subject: "festival de cucas",
      offerItems: ["festival de cucas"],
      price: 14.99,
      weekday: "quarta-feira",
      validity: "mês de novembro",
    });
  });
});
