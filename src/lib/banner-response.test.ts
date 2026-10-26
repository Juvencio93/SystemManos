import { describe, expect, it } from "vitest";
import {
  callGatewayJsonWithRetry,
  parseBannerResponse,
  safeBriefingFallbackQuestion,
} from "./banner-response";

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

  it("preserves a general semantic business mismatch decision", () => {
    const parsed = parseBannerResponse(
      JSON.stringify({
        needsMoreInfo: true,
        question: "Esse pedido é para a empresa cadastrada?",
        promptOptions: null,
        reminder: null,
        businessMismatch: true,
      }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      data: { needsMoreInfo: true, businessMismatch: true },
    });
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


describe("banner response null tolerance", () => {
  it("aceita unit null como ausência em vez de rejeitar o contrato", () => {
    const raw = `\`\`\`json
{
  "needsMoreInfo": false,
  "question": null,
  "promptOptions": [
    {
      "title": "Cuca em destaque",
      "prompt": "Banner com cuca em primeiro plano e texto 'FESTIVAL DE CUCAS'",
      "visualItems": ["cucas"],
      "commercialFacts": {
        "items": ["cucas"],
        "price": 19.9,
        "validity": "mês de novembro",
        "unit": null,
        "business": "EFRAIM PADARIA E CONFEITARIA LTDA",
        "scope": "confirmed"
      }
    },
    {
      "title": "Festival na padaria",
      "prompt": "Banner com vitrine de cucas e texto 'FESTIVAL DE CUCAS'",
      "visualItems": ["cucas"],
      "commercialFacts": {
        "items": ["cucas"],
        "price": 19.9,
        "validity": "mês de novembro",
        "unit": null,
        "business": "EFRAIM PADARIA E CONFEITARIA LTDA",
        "scope": "confirmed"
      }
    }
  ],
  "reminder": null
}
\`\`\``;
    const parsed = parseBannerResponse(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.promptOptions?.[0]?.commercialFacts?.unit).toBeUndefined();
    expect(parsed.data.promptOptions?.[0]?.commercialFacts?.price).toBe(19.9);
  });
});


describe("callGatewayJsonWithRetry", () => {
  const good = JSON.stringify({
    needsMoreInfo: false,
    question: null,
    promptOptions: [
      { title: "T1", prompt: "P1" },
      { title: "T2", prompt: "P2" },
    ],
  });
  const broken = '{"needsMoreInfo": false, "question": null, "promptOptions": [';
  const noop = () => {};
  it("tenta de novo uma vez quando o JSON vem quebrado e aproveita o segundo", async () => {
    const calls: string[][] = [];
    const failures: string[] = [];
    const result = await callGatewayJsonWithRetry(
      async (system, user) => {
        calls.push([system, user]);
        return calls.length === 1
          ? { ok: true, text: broken, requestId: "r1", error: null }
          : { ok: true, text: good, requestId: "r2", error: null };
      },
      "sys",
      "usr",
      (requestId) => {
        failures.push(requestId);
      },
    );
    expect(calls).toHaveLength(2);
    expect(failures).toEqual(["r1"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.parsed.data.promptOptions).toHaveLength(2);
  });
  it("desiste após o segundo JSON quebrado e sinaliza falha de parse", async () => {
    const failures: string[] = [];
    const result = await callGatewayJsonWithRetry(
      async (_system, _user) => ({ ok: true, text: broken, requestId: "r", error: null }),
      "sys",
      "usr",
      (requestId) => {
        failures.push(requestId);
      },
    );
    expect(failures).toHaveLength(2);
    expect(result).toEqual({ ok: false, gatewayError: null, parseFailed: true });
  });
  it("não retenta falha de gateway", async () => {
    let calls = 0;
    const result = await callGatewayJsonWithRetry(
      async (_system, _user) => {
        calls += 1;
        return { ok: false, text: null, requestId: "r", error: "boom" };
      },
      "sys",
      "usr",
      noop,
    );
    expect(calls).toBe(1);
    expect(result).toEqual({ ok: false, gatewayError: "boom", parseFailed: false });
  });
});
