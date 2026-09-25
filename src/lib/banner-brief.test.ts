import { describe, expect, it } from "vitest";
import {
  commercialCompletenessQuestion,
  createVisualSceneContract,
  createBrief,
  deriveConversationCommercialState,
  extractOfferItems,
  formatBRL,
  formatOfferPrice,
  keepGroundedPhysicalElements,
  mergeBrief,
  normalizeCurrencyCopy,
  normalizePrice,
  nextCommercialQuestion,
  physicalElementGroundingRule,
  sharedGroundTruth,
  shouldResearch,
  requiredOfferFactsFromBrief,
  validateGeneratedCommercialFacts,
  validatePromptVisualGrounding,
  extractBannerTurnFacts,
  validatePromptTemporalFacts,
  visualPolicy,
  validateSecondPromptCommercialDirection,
} from "./banner-brief";

describe("banner briefing engine", () => {
  it("retains product/unit and accepts a later price", () => {
    const a = mergeBrief(createBrief(), { product: "risoto de camarão", unit: "taça" });
    const price = normalizePrice("35 pila");
    expect(price).toBe(35);
    if (price === undefined) throw new Error("Expected a normalized price");
    const b = mergeBrief(a, { price });
    expect(b).toMatchObject({ product: "risoto de camarão", unit: "taça", price: 35 });
  });
  it("replaces corrected price, day and time", () => {
    let brief = mergeBrief(createBrief(), { price: 35, day: "sexta-feira", time: "18:00" });
    brief = mergeBrief(brief, { price: 39.9, day: "sábado", time: "19:30" });
    expect(brief).toMatchObject({ price: 39.9, day: "sábado", time: "19:30" });
  });
  it.each([
    ["12 reais", 12],
    ["12 real", 12],
    ["12 pila", 12],
    ["12 money", 12],
    ["R$12", 12],
    ["89,90", 89.9],
    ["R$ 1.299,90", 1299.9],
    ["Promoção: 2 pizzas por R$ 59,90", 59.9],
    ["Curso de inglês por R$ 1200", 1200],
  ])("normalizes %s", (input, expected) => expect(normalizePrice(input)).toBe(expected));
  it("formats a zero-value offer as grátis", () => {
    expect(formatOfferPrice(0)).toBe("GRÁTIS");
  });
  it("formats informal price input once, without a redundant currency word", () => {
    expect(formatBRL(normalizePrice("15 pila") ?? Number.NaN)).toBe("R$ 15,00");
    expect(normalizeCurrencyCopy("Oferta por R$ 15,00 reais")).toBe("Oferta por R$ 15,00");
    expect(normalizeCurrencyCopy("Oferta por R$ 15,00 reais")).not.toContain("reais");
    expect(normalizeCurrencyCopy("Oferta por 15 pila")).toBe("Oferta por R$ 15,00");
  });
  it("keeps shared facts equal for both creative directions", () => {
    const truth = sharedGroundTruth(
      mergeBrief(createBrief(), {
        product: "festival",
        price: 35,
        unit: "por pessoa",
        day: "quarta-feira",
        recurring: true,
      }),
    );
    expect(truth.commercial).toMatchObject({
      price: 35,
      unit: "por pessoa",
      day: "quarta-feira",
      recurring: true,
    });
  });
  it("protects unconfirmed and partial environments", () => {
    expect(visualPolicy("unconfirmed")).toContain("não simule");
    expect(visualPolicy("partial")).toContain("não simule");
  });
  it("does not require research for an empty brief and does for an institutional brief", () => {
    expect(shouldResearch(createBrief())).toBe(false);
    expect(shouldResearch(mergeBrief(createBrief(), { objective: "institutional" }))).toBe(true);
  });

  it("asks a period only for an explicitly temporal commercial request without one", () => {
    expect(
      commercialCompletenessQuestion([
        "Criar uma imagem para promoção da semana",
        "Bolo de cenoura com cobertura de chocolate e café passado por 15 pila",
      ]),
    ).toContain("Até quando essa promoção é válida?");
    expect(
      commercialCompletenessQuestion(["Quero um banner institucional apresentando a clínica"]),
    ).toBeNull();
    expect(commercialCompletenessQuestion(["Promoção da semana válida até domingo"])).toBeNull();
    expect(
      commercialCompletenessQuestion([
        "Festival de pizza somente quarta-feira, R$ 35,00 por pessoa",
      ]),
    ).toBeNull();
  });

  it("drops any unverified physical decoration by origin, not by object-name blacklist", () => {
    const allowed = keepGroundedPhysicalElements([
      { name: "bolo de cenoura anunciado", origin: "PRODUCT_INTRINSIC" },
      { name: "superfície neutra de estúdio", origin: "TECHNICALLY_NECESSARY" },
      { name: "cenoura decorativa", origin: "UNVERIFIED_DECORATION" },
      { name: "grãos de café decorativos", origin: "UNVERIFIED_DECORATION" },
      { name: "cesto de pães", origin: "UNVERIFIED_DECORATION" },
    ]);

    expect(allowed.map((element) => element.name)).toEqual([
      "bolo de cenoura anunciado",
      "superfície neutra de estúdio",
    ]);
    expect(physicalElementGroundingRule()).toContain("UNVERIFIED_DECORATION");
  });

  it("keeps the same verified facts while permitting distinct art directions", () => {
    const truth = sharedGroundTruth(
      mergeBrief(createBrief(), {
        product: "bolo de cenoura com cobertura de chocolate e café passado",
        price: 15,
        day: "quarta-feira",
      }),
    );

    expect(truth.commercial).toMatchObject({
      product: "bolo de cenoura com cobertura de chocolate e café passado",
      price: 15,
      day: "quarta-feira",
    });
    expect(truth.visual).toContain("cenário neutro/estúdio");
    expect(truth.restrictions).toContain("UNVERIFIED_DECORATION");
  });

  it("rejects unconfirmed environmental inventions before a prompt can be returned", () => {
    const contract = createVisualSceneContract("UNCONFIRMED");
    const invalid = [
      "fotografia no interior aconchegante da cafeteria",
      "janela ao fundo e balcão da loja",
      "canto rústico da padaria",
    ].join("; ");

    expect(
      validatePromptVisualGrounding(invalid, contract).map((violation) =>
        violation.phrase.toLowerCase(),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("interior aconchegante da cafeteria"),
        "janela",
        "balcão",
        expect.stringContaining("canto rústico da padaria"),
      ]),
    );
    expect(
      validatePromptVisualGrounding(
        "fundo neutro de estúdio e superfície neutra de apoio",
        contract,
      ),
    ).toEqual([]);
  });

  it("rejects the generic bottom-band flyer layout in the second direction", () => {
    expect(
      validateSecondPromptCommercialDirection(
        "produto em destaque acima; faixa inferior escura de largura total com texto centralizado e preço",
      ),
    ).toEqual([
      expect.objectContaining({ reason: "GENERIC_OPTION_2_LAYOUT" }),
    ]);
    expect(
      validateSecondPromptCommercialDirection(
        "grade assimétrica de doze colunas, produto em macro à esquerda e bloco tipográfico alinhado à margem direita, preço integrado ao título",
      ),
    ).toEqual([]);
    expect(
      validateSecondPromptCommercialDirection(
        "faixa inferior solicitada pelo cliente, com texto centralizado",
        true,
      ),
    ).toEqual([]);
  });

  it("retains service, price and semantic validity without making CTA or scope mandatory", () => {
    const messages = [
      "Quero uma promoção da semana para troca de óleo por 129 reais",
      "válida até domingo",
    ];
    expect(deriveConversationCommercialState(messages)).toMatchObject({
      hasSubject: true,
      hasPrice: true,
      hasValidity: true,
      hasConfirmedScope: true,
      isSingleService: true,
    });
    expect(nextCommercialQuestion(messages)).toBeNull();
  });

  it.each(["até domingo", "válido até domingo", "só até domingo"])(
    "treats %s as the same resolved validity fact",
    (validity) => {
      expect(
        nextCommercialQuestion(["Promoção da semana para troca de óleo por 129 reais", validity]),
      ).toBeNull();
    },
  );

  it("does not make institutional communication collect commercial fields", () => {
    expect(
      nextCommercialQuestion(["Quero um banner institucional apresentando a empresa"]),
    ).toBeNull();
  });

  it("builds required commercial facts from confirmed offer identities", () => {
    const required = requiredOfferFactsFromBrief(
      {
        subject: "bolo de cenoura com cobertura de chocolate e café passado",
        offerItems: extractOfferItems("bolo de cenoura com cobertura de chocolate e café passado"),
        price: 15,
        validity: "até domingo",
        scopeConfirmed: true,
      },
      "Panificadora Campos",
    );
    expect(required).toEqual({
      items: ["bolo de cenoura com cobertura de chocolate", "café passado"],
      price: 15,
      validity: "até domingo",
      business: "Panificadora Campos",
      scope: "confirmed",
    });
  });

  it("rejects an option that writes coffee but omits it from the visual composition", () => {
    const required = {
      items: ["bolo de cenoura", "café passado"],
      price: 15,
      validity: "até domingo",
      business: "Campos",
      scope: "confirmed" as const,
    };
    const violations = validateGeneratedCommercialFacts(
      {
        visualItems: ["bolo de cenoura"],
        commercialFacts: {
          items: ["bolo de cenoura", "café passado"],
          price: 15,
          validity: "até domingo",
          business: "Campos",
          scope: "confirmed",
        },
      },
      required,
    );
    expect(violations).toContainEqual(
      expect.objectContaining({
        reason: "MISSING_OFFER_ITEM",
        detail: expect.stringContaining("café"),
      }),
    );
  });

  it.each([
    [
      "wrong price",
      {
        visualItems: ["bolo de cenoura", "café passado"],
        commercialFacts: {
          items: ["bolo de cenoura", "café passado"],
          price: 17,
          validity: "até domingo",
          business: "Campos",
          scope: "confirmed",
        },
      },
      "WRONG_PRICE",
    ],
    [
      "missing validity",
      {
        visualItems: ["bolo de cenoura", "café passado"],
        commercialFacts: {
          items: ["bolo de cenoura", "café passado"],
          price: 15,
          business: "Campos",
          scope: "confirmed",
        },
      },
      "MISSING_VALIDITY",
    ],
    [
      "extra bread",
      {
        visualItems: ["bolo de cenoura", "café passado", "pão"],
        commercialFacts: {
          items: ["bolo de cenoura", "café passado", "pão"],
          price: 15,
          validity: "até domingo",
          business: "Campos",
          scope: "confirmed",
        },
      },
      "EXTRA_OFFER_ITEM",
    ],
  ] as const)("rejects %s", (_label, generated, reason) => {
    const violations = validateGeneratedCommercialFacts(generated, {
      items: ["bolo de cenoura", "café passado"],
      price: 15,
      validity: "até domingo",
      business: "Campos",
      scope: "confirmed",
    });
    expect(violations).toContainEqual(expect.objectContaining({ reason }));
  });

  it("requires an explicitly confirmed price unit in generated metadata", () => {
    const violations = validateGeneratedCommercialFacts(
      {
        visualItems: ["festival de sopas"],
        commercialFacts: {
          items: ["festival de sopas"],
          price: 35,
          validity: "quarta-feira",
          business: "Campos",
          scope: "confirmed",
        },
      },
      {
        items: ["festival de sopas"],
        price: 35,
        weekday: "quarta-feira",
        unit: "por pessoa",
        business: "Campos",
        scope: "confirmed",
      },
    );
    expect(violations).toContainEqual(expect.objectContaining({ reason: "MISSING_UNIT" }));
  });

  it("accepts equal commercial facts while the art direction remains free", () => {
    const violations = validateGeneratedCommercialFacts(
      {
        visualItems: ["fatia de bolo de cenoura", "xícara de café passado"],
        commercialFacts: {
          items: ["bolo de cenoura", "café passado"],
          price: 15,
          validity: "até domingo",
          business: "Campos",
          scope: "confirmed",
        },
      },
      {
        items: ["bolo de cenoura", "café passado"],
        price: 15,
        validity: "até domingo",
        business: "Campos",
        scope: "confirmed",
      },
    );
    expect(violations).toEqual([]);
  });
});

describe("weekday and recurrence semantics", () => {
  it.each([
    ["segunda", "segunda-feira"],
    ["terça", "terça-feira"],
    ["quarta", "quarta-feira"],
    ["quinta", "quinta-feira"],
    ["sexta", "sexta-feira"],
    ["sábado", "sábado"],
    ["domingo", "domingo"],
  ])("keeps event %s as a one-off weekday", (input, weekday) => {
    const facts = extractBannerTurnFacts(`evento ${input}`);
    expect(facts).toMatchObject({ weekday, recurrence: "NONE" });
    expect(facts.validity).toBeUndefined();
  });

  it.each([
    ["evento toda segunda", "segunda-feira"],
    ["evento toda terça", "terça-feira"],
    ["evento toda quarta", "quarta-feira"],
    ["evento toda quinta", "quinta-feira"],
    ["evento toda sexta", "sexta-feira"],
    ["evento todo sábado", "sábado"],
    ["evento todo domingo", "domingo"],
  ])("recognizes explicit weekly recurrence in %s", (message, weekday) => {
    expect(extractBannerTurnFacts(message)).toMatchObject({ weekday, recurrence: "WEEKLY" });
  });

  it("preserves date context, multiple days and the absence of recurrence", () => {
    expect(extractBannerTurnFacts("evento nesta quarta-feira")).toMatchObject({
      weekday: "quarta-feira",
      dateContext: "this",
      recurrence: "NONE",
    });
    expect(extractBannerTurnFacts("evento próxima quarta-feira")).toMatchObject({
      weekday: "quarta-feira",
      dateContext: "next",
      recurrence: "NONE",
    });
    expect(extractBannerTurnFacts("evento sábado e domingo")).toMatchObject({
      weekdays: ["sábado", "domingo"],
      recurrence: "NONE",
    });
    expect(extractBannerTurnFacts("evento de sexta a domingo")).toMatchObject({
      weekdays: ["sexta-feira", "domingo"],
      recurrence: "NONE",
    });
    expect(extractBannerTurnFacts("evento todos os sábados e domingos")).toMatchObject({
      weekdays: ["sábado", "domingo"],
      recurrence: "WEEKLY",
    });
    expect(extractBannerTurnFacts("evento semanalmente às quartas")).toMatchObject({
      weekday: "quarta-feira",
      recurrence: "WEEKLY",
    });
    expect(extractBannerTurnFacts("evento de segunda a sexta, toda semana")).toMatchObject({
      weekdays: ["segunda-feira", "sexta-feira"],
      recurrence: "WEEKLY",
    });
  });

  it("rejects invented weekly wording while accepting an explicit recurrence", () => {
    const oneOff = requiredOfferFactsFromBrief({ weekday: "quarta-feira", recurrence: "NONE" });
    expect(validatePromptTemporalFacts("Oferta toda quarta-feira", oneOff)).toContainEqual(
      expect.objectContaining({ reason: "INVENTED_RECURRENCE" }),
    );
    const weekly = requiredOfferFactsFromBrief({ weekday: "quarta-feira", recurrence: "WEEKLY" });
    expect(validatePromptTemporalFacts("Oferta toda quarta-feira", weekly)).toEqual([]);
  });
});
