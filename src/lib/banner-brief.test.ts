import { describe, expect, it } from "vitest";
import { resolveBannerConversationTurn } from "./banner-agent.functions";
import {
  commercialCompletenessQuestion,
  createVisualSceneContract,
  createBrief,
  deriveConversationCommercialState,
  extractOfferItems,
  extractPricedItems,
  resolvePendingBannerQuestion,
  resolveRelativeDateValidity,
  formatBRL,
  formatOfferPrice,
  keepGroundedPhysicalElements,
  mergeBrief,
  mergeBannerConversationBrief,
  normalizeCurrencyCopy,
  normalizePrice,
  nextCommercialQuestion,
  physicalElementGroundingRule,
  sharedGroundTruth,
  shouldResearch,
  requiredOfferFactsFromBrief,
  validateGeneratedCommercialFacts,
  validatePromptConceptSeparation,
  validatePromptNoRegistryData,
  validatePromptCommercialCopy,
  validatePromptVisualGrounding,
  extractBannerTurnFacts,
  isResolvedQuestion,
  sanitizeGeneratedItems,
  validatePromptTemporalFacts,
  validatePromptTextQuality,
  visualPolicy,
  validateSecondPromptCommercialDirection,
  validatePromptOfferTexts,} from "./banner-brief";

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
  it("understands free offers embedded in a sentence without asking redundant questions", () => {
    const messages = [
      "Quero um banner para avaliação gratuita durante setembro, por conta da casa",
    ];
    expect(extractBannerTurnFacts(messages[0] ?? "")).toMatchObject({
      price: 0,
      freeCopyConfirmed: true,
    });
    expect(nextCommercialQuestion(messages)).toBeNull();
  });
  it("extracts the actual products from a courtesy-with-purchase request, not the user's instructions", () => {
    const facts = extractBannerTurnFacts(
      "Teste interno: crie duas ideias para divulgar que neste sábado a Efraim Padaria oferece um café cortesia na compra de qualquer pão francês. Deixe claro que o café é grátis e não invente preço.",
    );

    expect(facts).toMatchObject({
      subject: "pão francês e café",
      price: 0,
      commercialCondition: "grátis",
      weekday: "sábado",
      freeCopyConfirmed: true,
    });
    expect(extractOfferItems(facts.subject)).toEqual(["pão francês", "café"]);
  });
  it("treats 'por conta da casa' as zero price without replacing the banner wording", () => {
    const facts = extractBannerTurnFacts("Feijoda por conta da casa");
    expect(facts).toMatchObject({
      subject: "Feijoda",
      price: 0,
      commercialCondition: "por conta da casa",
      freeCopyConfirmed: true,
    });
    const required = requiredOfferFactsFromBrief(facts);
    expect(required.commercialCopy).toBe("por conta da casa");
    expect(
      validatePromptCommercialCopy(
        "Banner da Feijoada. Manter exatamente a expressão POR CONTA DA CASA.",
        required,
      ),
    ).toEqual([]);
    expect(
      validatePromptCommercialCopy("Banner da Feijoada. Exibir exatamente GRÁTIS.", required),
    ).toContainEqual(expect.objectContaining({ reason: "MISSING_COMMERCIAL_COPY" }));
  });
  it("clears an incompatible offer when the user rejects the business mismatch", () => {
    expect(
      resolvePendingBannerQuestion(
        {
          ...extractBannerTurnFacts("Feijoada por conta da casa"),
          pendingQuestion: "business_compatibility_confirmation",
        },
        "Não",
      ),
    ).toEqual({ pendingQuestion: "subject", compatibilityConfirmed: false });
  });
  it("removes test framing before extracting combo products and price", () => {
    const facts = extractBannerTurnFacts(
      "Teste interno: criar duas opções de banner bem diferentes para a Efraim Padaria: combo com 2 cafés e 1 pão de queijo por R$ 18,90 neste sábado.",
    );

    expect(facts.subject).toBe("combo com 2 cafés e 1 pão de queijo");
    expect(extractOfferItems(facts.subject)).toEqual(["2 cafés", "1 pão de queijo"]);
    expect(facts).toMatchObject({ price: 18.9, weekday: "sábado" });
  });
  it("does not reinterpret a negated free claim as a zero-price offer", () => {
    expect(extractBannerTurnFacts("A avaliação não é gratuita")).not.toHaveProperty("price", 0);
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
    ).toContain("Até quando ou em quais dias essa promoção é válida?");
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
  it("asks when an ordinary promotion with a free offer is valid", () => {
    const messages = ["Quero criar um banner de promoção", "Feijoda por conta da casa"];
    expect(nextCommercialQuestion(messages)).toContain("vale até quando ou em quais dias");
    expect(nextCommercialQuestion([...messages, "Válida somente neste sábado"])).toBeNull();
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
    ).toEqual([expect.objectContaining({ reason: "GENERIC_OPTION_2_LAYOUT" })]);
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

  it("rejects near-identical prompt concepts but accepts different visual narratives", () => {
    const first =
      "Fotografia editorial de produto como protagonista, composição em macro, luz lateral, fundo escuro e tipografia serifada.";
    expect(validatePromptConceptSeparation(first, first)).toContainEqual(
      expect.objectContaining({ reason: "SIMILAR_PROMPT_CONCEPTS" }),
    );
    expect(
      validatePromptConceptSeparation(
        "Fotografia publicitária do produto como protagonista, enquadramento próximo em três quartos, composição assimétrica com área negativa, luz lateral direcional e tipografia secundária.",
        "Cartaz tipográfico de design gráfico, tipografia como protagonista, produto fotográfico como apoio, vista zenital aberta em grade modular, luz difusa uniforme e texto conduz a leitura.",
      ),
    ).toEqual([]);
    expect(
      validatePromptConceptSeparation(
        "Fotografia publicitária do produto como protagonista, enquadramento próximo em três quartos e luz lateral direcional.",
        "Cartaz tipográfico de design gráfico, tipografia como protagonista e luz difusa uniforme.",
      ),
    ).toContainEqual(expect.objectContaining({ reason: "SIMILAR_PROMPT_CONCEPTS" }));
    expect(
      validatePromptConceptSeparation(
        first,
        "Fotografia editorial em vista zenital, grade modular, luz difusa, fundo claro e tipografia sem serifa.",
      ),
    ).toContainEqual(expect.objectContaining({ reason: "SIMILAR_PROMPT_CONCEPTS" }));
  });

  it("blocks registry/contact data from generated prompts without rejecting ordinary offer text", () => {
    expect(
      validatePromptNoRegistryData(
        "Banner para EFRAIM PADARIA: CNPJ 33.148.655/0001-60; Capital Social R$ 20.000,00; sócio administrador.",
      ),
    ).toContainEqual(expect.objectContaining({ reason: "RESEARCH_DATA_LEAK" }));
    expect(
      validatePromptNoRegistryData("Exibir café GRÁTIS na compra de pão francês neste sábado."),
    ).toEqual([]);
    expect(
      validatePromptNoRegistryData("Contato: contato@exemplo.com, telefone (47) 98476-5015."),
    ).toContainEqual(expect.objectContaining({ reason: "RESEARCH_DATA_LEAK" }));
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

  it("does not ask for a price unless the request calls for a promotion or price highlight", () => {
    expect(nextCommercialQuestion(["Quero um banner para divulgar bolo de cenoura"])).toBeNull();
    expect(nextCommercialQuestion(["Quero um banner de promoção para bolo de cenoura"])).toContain(
      "Qual valor",
    );
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

describe("multi-price offers (pricedItems)", () => {
  it("extracts two items with different prices", () => {
    const items = extractPricedItems("Centro de salgadinhos por 89,90 e 35 reais o quilo do bolo");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ price: 89.9 });
    expect(items[0]?.item).toMatch(/salgadinho/i);
    expect(items[1]).toMatchObject({ price: 35, unit: "quilo" });
    expect(items[1]?.item).toMatch(/bolo/i);
  });

  it("returns [] for a single price (legacy flow)", () => {
    expect(extractPricedItems("bolo de chocolate 35 reais")).toEqual([]);
  });

  it("extractBannerTurnFacts sets pricedItems instead of price for multi-price", () => {
    const facts = extractBannerTurnFacts("salgadinhos 89,90 e bolo 35 reais o quilo");
    expect(facts.pricedItems).toHaveLength(2);
    expect(facts.price).toBeUndefined();
  });

  it("supports one free item and one paid item", () => {
    const items = extractPricedItems("polenta por conta da casa e bolo 35 reais");
    expect(items).toHaveLength(2);
    const free = items.find((i) => i.price === 0);
    const paid = items.find((i) => i.price === 35);
    expect(free?.item).toMatch(/polenta/i);
    expect(paid?.item).toMatch(/bolo/i);
  });

  it("merge replaces single price with pricedItems and vice-versa", () => {
    const multi = mergeBannerConversationBrief(
      { price: 35 },
      {
        pricedItems: [
          { item: "a", price: 10 },
          { item: "b", price: 20 },
        ],
      },
    );
    expect(multi.pricedItems).toHaveLength(2);
    expect(multi.price).toBeUndefined();

    const single = mergeBannerConversationBrief(
      {
        pricedItems: [
          { item: "a", price: 10 },
          { item: "b", price: 20 },
        ],
      },
      { price: 35 },
    );
    expect(single.price).toBe(35);
    expect(single.pricedItems).toBeUndefined();
  });

  it("validates two items/two prices correctly", () => {
    const required = requiredOfferFactsFromBrief({
      offerItems: ["salgadinhos", "bolo"],
      pricedItems: [
        { item: "salgadinhos", price: 89.9 },
        { item: "bolo", price: 35, unit: "quilo" },
      ],
      scopeConfirmed: true,
    });
    expect(required.pricedItems).toHaveLength(2);

    const ok = validateGeneratedCommercialFacts(
      {
        visualItems: ["salgadinhos", "bolo"],
        commercialFacts: {
          items: ["salgadinhos", "bolo"],
          pricedItems: [
            { item: "salgadinhos", price: 89.9 },
            { item: "bolo", price: 35, unit: "quilo" },
          ],
          scope: "confirmed",
        },
      },
      required,
    );
    expect(ok).toEqual([]);
  });

  it("fails when the second item has the wrong price", () => {
    const required = requiredOfferFactsFromBrief({
      offerItems: ["salgadinhos", "bolo"],
      pricedItems: [
        { item: "salgadinhos", price: 89.9 },
        { item: "bolo", price: 35 },
      ],
      scopeConfirmed: true,
    });
    const violations = validateGeneratedCommercialFacts(
      {
        visualItems: ["salgadinhos", "bolo"],
        commercialFacts: {
          items: ["salgadinhos", "bolo"],
          pricedItems: [
            { item: "salgadinhos", price: 89.9 },
            { item: "bolo", price: 39.9 },
          ],
          scope: "confirmed",
        },
      },
      required,
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ reason: "WRONG_PRICE", detail: expect.stringContaining("bolo") }),
    );
  });

  it("fails on an extra unconfirmed price", () => {
    const required = requiredOfferFactsFromBrief({
      offerItems: ["salgadinhos"],
      pricedItems: [{ item: "salgadinhos", price: 89.9 }],
      scopeConfirmed: true,
    });
    const violations = validateGeneratedCommercialFacts(
      {
        visualItems: ["salgadinhos", "refrigerante"],
        commercialFacts: {
          items: ["salgadinhos", "refrigerante"],
          pricedItems: [
            { item: "salgadinhos", price: 89.9 },
            { item: "refrigerante", price: 8 },
          ],
          scope: "confirmed",
        },
      },
      required,
    );
    expect(
      violations.some((v) => v.reason === "WRONG_PRICE" && v.detail.includes("refrigerante")),
    ).toBe(true);
  });

  it("keeps single-price backward compatibility", () => {
    const required = requiredOfferFactsFromBrief({
      subject: "bolo de chocolate",
      offerItems: ["bolo de chocolate"],
      price: 35,
      scopeConfirmed: true,
    });
    // Preço único legado: sem pricedItems no required.
    expect(required.pricedItems).toBeUndefined();
    expect(required.price).toBe(35);

    const ok = validateGeneratedCommercialFacts(
      {
        visualItems: ["bolo de chocolate"],
        commercialFacts: {
          items: ["bolo de chocolate"],
          price: 35,
          scope: "confirmed",
        },
      },
      required,
    );
    expect(ok).toEqual([]);

    const wrong = validateGeneratedCommercialFacts(
      {
        visualItems: ["bolo de chocolate"],
        commercialFacts: {
          items: ["bolo de chocolate"],
          price: 39.9,
          scope: "confirmed",
        },
      },
      required,
    );
    expect(wrong).toContainEqual(expect.objectContaining({ reason: "WRONG_PRICE" }));
  });
});

describe("relative date resolution", () => {
  // Domingo, 18 de outubro de 2026 (America/Sao_Paulo).
  const ref = new Date("2026-10-18T15:00:00-03:00");

  it("resolves 'essa semana' to the current week range", () => {
    expect(resolveRelativeDateValidity("válido pra essa semana", ref)).toBe(
      "12 a 18 de outubro de 2026",
    );
  });

  it("resolves 'esse mês' to the current month/year", () => {
    expect(resolveRelativeDateValidity("promoção para esse mês", ref)).toBe("outubro de 2026");
  });

  it("resolves 'do dia 11 ao dia 15' with the current month/year", () => {
    expect(resolveRelativeDateValidity("do dia 11 ao dia 15", ref)).toBe(
      "11 a 15 de outubro de 2026",
    );
  });

  it("resolves future '11/11' to this year", () => {
    expect(resolveRelativeDateValidity("promoção 11/11", ref)).toBe("11 de novembro de 2026");
  });

  it("resolves past '10/10' to next year", () => {
    expect(resolveRelativeDateValidity("promoção 10/10", ref)).toBe("10 de outubro de 2027");
  });

  it("prefers the resolved date over the raw validity text", () => {
    const facts = extractBannerTurnFacts("promoção válida pra essa semana");
    // Não deve manter o texto cru "essa semana".
    expect(facts.validity).not.toMatch(/essa semana/i);
    expect(facts.validity).toMatch(
      /\d{1,2} a \d{1,2} de \w+ de \d{4}|\d{1,2} de \w+ a \d{1,2} de \w+ de \d{4}/,
    );
  });
});

describe("multi-day offers", () => {
  it("understands 'Terça e Quinta' as two weekdays", () => {
    expect(extractBannerTurnFacts("música ao vivo terça e quinta")).toMatchObject({
      weekday: "terça-feira",
      weekdays: ["terça-feira", "quinta-feira"],
    });
  });

  it("keeps WEEKLY recurrence for all listed days", () => {
    const facts = extractBannerTurnFacts("toda terça e quinta tem música ao vivo");
    expect(facts.weekdays).toEqual(["terça-feira", "quinta-feira"]);
    expect(facts.recurrence).toBe("WEEKLY");
    const required = requiredOfferFactsFromBrief(facts);
    expect(required.weekdays).toEqual(["terça-feira", "quinta-feira"]);
    expect(required.recurrence).toBe("WEEKLY");
  });

  it("rejects prompts missing one of the listed days", () => {
    const required = requiredOfferFactsFromBrief({
      weekdays: ["terça-feira", "quinta-feira"],
      weekday: "terça-feira",
      recurrence: "NONE",
    });
    const violations = validatePromptTemporalFacts(
      "Música ao vivo toda terça-feira com entrada gratuita",
      required,
    );
    expect(violations).toContainEqual(
      expect.objectContaining({
        reason: "MISSING_VALIDITY",
        detail: expect.stringContaining("quinta-feira"),
      }),
    );
  });

  it("accepts prompts mentioning all days without invented recurrence", () => {
    const required = requiredOfferFactsFromBrief({
      weekdays: ["terça-feira", "quinta-feira"],
      weekday: "terça-feira",
      recurrence: "WEEKLY",
    });
    expect(
      validatePromptTemporalFacts(
        "Música ao vivo toda terça e quinta-feira, entrada gratuita",
        required,
      ),
    ).toEqual([]);
  });

  it("asks proactively about date/day for commercial offers without date info", () => {
    const question = nextCommercialQuestion(["quero um banner de salgadinhos 89,90"], {
      subject: "salgadinhos",
      pricedItems: [{ item: "salgadinhos", price: 89.9 }],
    });
    expect(question).toMatch(/data especial|dia da semana/i);
  });

  it("does not repeat the date question once asked", () => {
    const brief = resolvePendingBannerQuestion(
      { subject: "salgadinhos", pendingQuestion: "date_confirmation" },
      "não, sem data específica",
    );
    expect(brief.dateAsked).toBe(true);
    expect(brief.pendingQuestion).toBeUndefined();
    const question = nextCommercialQuestion(["quero um banner de salgadinhos 89,90"], {
      subject: "salgadinhos",
      pricedItems: [{ item: "salgadinhos", price: 89.9 }],
      dateAsked: true,
    });
    expect(question).toBeNull();
  });
});

describe("prompt text quality", () => {
  it("rejects long quoted texts", () => {
    const violations = validatePromptTextQuality(
      'Banner com o texto "Promoção imperdível de salgadinhos deliciosos para a sua festa de aniversário" em destaque',
    );
    expect(violations).toContainEqual(expect.objectContaining({ reason: "TEXT_TOO_LONG" }));
  });

  it("rejects too many distinct texts", () => {
    const violations = validatePromptTextQuality(
      'Textos "SÓ HOJE" e "50% OFF" e "FRETE GRÁTIS" e "PARCELE EM 12X" e "GARANTA JÁ" no banner',
    );
    expect(violations).toContainEqual(expect.objectContaining({ reason: "TOO_MANY_TEXTS" }));
  });

  it("accepts short exact texts with hierarchy", () => {
    expect(
      validatePromptTextQuality(
        'Título "SÓ HOJE" em bold sans-serif, oferta "R$ 89,90" em destaque, CTA "PEÇA JÁ" no canto',
      ),
    ).toEqual([]);
  });

  it("flags vague text instructions without exact quoted text", () => {
    const violations = validatePromptTextQuality(
      "Incluir um texto sobre a promoção no canto superior do banner",
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ reason: "VAGUE_TEXT_INSTRUCTION" }),
    );
  });
});

describe("textos da oferta no banner", () => {
  const required = {
    items: ["festival de cucas"],
    price: 14.99,
    scope: "confirmed" as const,
  };
  it("reprova textos que trocam a cuca por pão e escondem o preço", () => {
    const prompt =
      'Banner. Textos exatos: título "TODA QUARTA-FEIRA"; abaixo "PÃO QUENTINHO"; CTA "PEÇA AGORA". Um pão dourado em primeiro plano.';
    const violations = validatePromptOfferTexts(prompt, required);
    expect(violations.map((v) => v.reason)).toEqual([
      "MISSING_OFFER_TEXT",
      "MISSING_OFFER_TEXT",
    ]);
  });
  it("aprova textos com o nome da oferta e o preço", () => {
    const prompt =
      'Banner. Textos exatos: título "FESTIVAL DE CUCAS"; abaixo "CUCAS DIVERSOS SABORES POR R$ 14,99"; CTA "PEÇA AGORA". Cucas variadas em primeiro plano.';
    expect(validatePromptOfferTexts(prompt, required)).toEqual([]);
  });
  it("não exige preço de oferta gratuita", () => {
    const prompt = 'Banner. Textos exatos: título "FESTIVAL DE CUCAS"; CTA "PEÇA AGORA".';
    expect(
      validatePromptOfferTexts(prompt, { items: ["festival de cucas"], price: 0, scope: "confirmed" }),
    ).toEqual([]);
  });
});

describe("assunto não vira fato", () => {
  it("resposta tudo junto não substitui o assunto nem vira item", () => {
    const facts = extractBannerTurnFacts(
      "toda quarta feira, valor de 14,99 válidos para o mês de novembro",
    );
    expect(facts.subject).toBeUndefined();
    expect(facts.price).toBe(14.99);
    expect(facts.weekday).toMatch(/quarta/iu);
    expect(facts.validity).toMatch(/novembro/iu);
    const merged = mergeBannerConversationBrief(
      { subject: "festival de cucas", offerItems: ["festival de cucas"] },
      facts,
    );
    expect(merged.subject).toBe("festival de cucas");
    expect(merged.offerItems).toEqual(["festival de cucas"]);
    expect(
      extractOfferItems("toda quarta feira, valor de 14,99 válidos para o mês de novembro"),
    ).toEqual([]);
  });
});

describe("direção criativa instruída", () => {
  it("passa na separação de conceitos com o vocabulário dos quatro eixos opostos", () => {
    const primeira =
      "protagonismo da oferta, fotografia publicitária de produto em plano próximo: plano fechado, detalhe ampliado, ponto focal, produto dominante e área negativa, luz lateral dramática, tipografia discreta em segundo plano, hierarquia visual liderada pela imagem";
    const segunda =
      "experiência da marca em composição ampla: plano aberto, visão ampla, composição ampla contextual, cena editorial, luz difusa e uniforme, tipografia como protagonista, texto que conduz a leitura";
    expect(validatePromptConceptSeparation(primeira, segunda)).toEqual([]);
    expect(validatePromptConceptSeparation(segunda, primeira)).toEqual([]);
  });
  it("reprova duas opções com o mesmo fundo e aprova fundo escuro × claro", () => {
    const primeira =
      "protagonismo da oferta, fotografia publicitária de produto em plano próximo: plano fechado, detalhe ampliado, ponto focal, produto dominante e área negativa, luz lateral dramática, tipografia discreta em segundo plano, hierarquia visual liderada pela imagem, fundo escuro";
    const segundaClara =
      "experiência da marca em composição ampla: plano aberto, visão ampla, composição ampla contextual, cena editorial, luz difusa e uniforme, tipografia como protagonista, texto que conduz a leitura, fundo claro";
    const segundaEscura = segundaClara.replace("fundo claro", "fundo escuro");
    expect(validatePromptConceptSeparation(primeira, segundaClara)).toEqual([]);
    expect(validatePromptConceptSeparation(primeira, segundaEscura)).toContainEqual(
      expect.objectContaining({ reason: "SIMILAR_PROMPT_CONCEPTS" }),
    );
  });
});

describe("interpretação de gratuidade e higiene de metadados", () => {
  it("por conta da casa já é preço zero com cópia confirmada", () => {
    const facts = extractBannerTurnFacts("Quero um banner do café por conta da casa", {});
    expect(facts.price).toBe(0);
    expect(facts.commercialCondition).toBe("por conta da casa");
    expect(facts.freeCopyConfirmed).toBe(true);
  });

  it.each([
    ["café de graça", 0],
    ["pão na faixa", 0],
    ["bolo cortesia", 0],
    ["café sem pagar nada", 0],
    ["a casa paga o café", 0],
    ["café gratuito", 0],
  ])("associa %s a gratuidade", (message, expected) => {
    expect(extractBannerTurnFacts(message, {}).price).toBe(expected);
  });

  it("sem cortesia não é gratuidade", () => {
    const facts = extractBannerTurnFacts("café sem cortesia", {});
    expect(facts.price).toBeUndefined();
    expect(facts.commercialCondition).toBeUndefined();
    expect(facts.freeCopyConfirmed).toBeUndefined();
  });

  it("na faixa de número é faixa de preço, não gratuidade", () => {
    const facts = extractBannerTurnFacts("café na faixa de 20 reais", {});
    expect(facts.price).toBe(20);
  });

  it("por conta da casa não gera pergunta de valor nem de redação da cortesia", () => {
    const turn = resolveBannerConversationTurn({}, ["Quero um banner do café por conta da casa"]);
    expect(turn.brief.price).toBe(0);
    expect(turn.brief.freeCopyConfirmed).toBe(true);
    expect(turn.nextQuestion).not.toMatch(/cortesia|qual (o )?valor/i);
  });

  it("pergunta de redação da cortesia é resolvida quando a cópia já foi confirmada", () => {
    expect(
      isResolvedQuestion(
        "Como você prefere escrever essa cortesia no banner: “Grátis” ou “Por conta da casa”?",
        ["café por conta da casa"],
        { freeCopyConfirmed: true },
      ),
    ).toBe(true);
  });

  it("remove preço e validade da lista de itens gerados, mas mantém o dia", () => {
    expect(
      sanitizeGeneratedItems([
        "Festival de cucas",
        "R$ 19,90",
        "válido para o mês de novembro",
        "toda quarta-feira",
        "cucas",
        "",
      ]),
    ).toEqual(["Festival de cucas", "toda quarta-feira", "cucas"]);
    expect(sanitizeGeneratedItems(undefined)).toBeUndefined();
  });
});
