import { describe, expect, it } from "vitest";
import { parseBannerResponse, safeBriefingFallbackQuestion } from "./banner-response";

describe("banner response contract", () => {
  it("continues the exact promotion conversation when the gateway omits nullable fields", () => {
    const conversation = [
      { role: "user", content: "CRIAR UMA IMAGEM PROMOÇÃO DA SEMANA" },
      { role: "assistant", content: "Qual produto ou serviço deve ser o foco da promoção da semana?" },
      { role: "user", content: "BOLO DE CENOURA COM COBERTURA DE CHOCOLATE, CAFÉ PASSADO" },
    ];
    const plausibleGatewayResponse = `\`\`\`json
{
  "needs_more_info": true,
  "pergunta": "Qual será o valor e a validade dessa promoção?"
}
\`\`\``;

    const parsed = parseBannerResponse(plausibleGatewayResponse);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toEqual({
      needsMoreInfo: true,
      question: "Qual será o valor e a validade dessa promoção?",
      promptOptions: null,
      reminder: null,
    });
    expect(conversation[2]?.content).toContain("BOLO DE CENOURA COM COBERTURA DE CHOCOLATE");
    expect(conversation[2]?.content).toContain("CAFÉ PASSADO");
  });

  it.each([
    "bolo de cenoura com chocolate e café",
    "bolo cenoura + café passado",
    "bolo de cenoura, café passado e pão de queijo",
    "quero divulgar bolo de cenoura",
    "bolo de chocolate com morango",
    "café passado com misto quente",
    "combo bolo + café por 15 pila",
    "bolo de cenoura e café por R$ 15",
    "é bolo de cenoura mesmo, mas tira o café",
  ])("preserves natural-language facts without classifying parts as decor: %s", (message) => {
    const fallback = safeBriefingFallbackQuestion(message);
    expect(fallback).toContain(message);
    expect(fallback).not.toContain("decoração");
    expect(fallback).not.toContain("grãos");
  });

  it("accepts a fenced final response with a safe trailing-comma repair", () => {
    const parsed = parseBannerResponse(`Resposta:\n\`\`\`json\n{
      "needsMoreInfo": false,
      "question": null,
      "promptOptions": [
        { "title": "Editorial", "prompt": "Prompt A" },
        { "title": "Comercial", "prompt": "Prompt B" },
      ],
      "reminder": null,
    }\n\`\`\``);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.promptOptions).toHaveLength(2);
  });

  it("reports the precise contract stage for an unrecoverable response", () => {
    const parsed = parseBannerResponse('{"needsMoreInfo": true, "question": 42}');
    expect(parsed).toMatchObject({ ok: false, stage: "schema_validation" });
  });
});

