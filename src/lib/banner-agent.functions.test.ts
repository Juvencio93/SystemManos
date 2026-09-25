import { describe, expect, it } from "vitest";
import { BannerAgentInputSchema, resolveBannerConversationTurn } from "./banner-agent.functions";
import {
  extractBannerTurnFacts,
  isResolvedQuestion,
  requiredOfferFactsFromBrief,
} from "./banner-brief";

describe("banner agent production turn orchestrator", () => {
  it("preserves the pending question through the runtime payload schema", () => {
    const parsed = BannerAgentInputSchema.parse({
      conversationId: "e1d96ac2-9325-4b56-9900-d6ff2ca714c1",
      isFinalTurn: true,
      messages: [{ role: "user", content: "sim" }],
      brief: {
        subject: "bolo de cenoura com cobertura de chocolate e café passado",
        price: 15,
        validity: "até domingo",
        pendingQuestion: "offer_scope_confirmation",
      },
    });
    expect(parsed.brief.pendingQuestion).toBe("offer_scope_confirmation");
  });

  it("keeps the pending question across response-to-next-request roundtrip", () => {
    const backendResponseBrief = {
      subject: "bolo de cenoura com cobertura de chocolate e café passado",
      price: 15,
      validity: "até domingo",
      pendingQuestion: "offer_scope_confirmation" as const,
    };
    const request = BannerAgentInputSchema.parse({
      conversationId: "e1d96ac2-9325-4b56-9900-d6ff2ca714c1",
      isFinalTurn: true,
      messages: [{ role: "user", content: "sim" }],
      brief: backendResponseBrief,
    });
    const turn = resolveBannerConversationTurn(request.brief, ["sim"]);
    expect(turn.brief).toMatchObject({ price: 15, validity: "até domingo", scopeConfirmed: true });
    expect(turn.brief.pendingQuestion).toBeUndefined();
    expect(turn.nextQuestion).toBeNull();
  });

  it("infers a clearly joined offer throughout the reproduced multi-turn promotion", () => {
    let brief = {};
    let messages = ["Criar uma imagem promoção da semana"];
    let turn = resolveBannerConversationTurn(brief, messages);
    expect(turn.nextQuestion).toMatch(/produto, serviço ou condição/i);

    brief = turn.brief;
    messages = [...messages, "Bolo de cenoura com cobertura de chocolate e café passado"];
    turn = resolveBannerConversationTurn(brief, messages);
    expect(turn.nextQuestion).toMatch(/dia específico|durante a semana|período definido/i);

    brief = turn.brief;
    messages = [...messages, "até domingo"];
    turn = resolveBannerConversationTurn(brief, messages);
    expect(turn.brief).toMatchObject({
      subject: "Bolo de cenoura com cobertura de chocolate e café passado",
      validity: "até domingo",
    });
    expect(turn.nextQuestion).toMatch(/valor exato/i);

    brief = turn.brief;
    messages = [...messages, "15 pila"];
    turn = resolveBannerConversationTurn(brief, messages);
    expect(turn.brief).toMatchObject({
      subject: "Bolo de cenoura com cobertura de chocolate e café passado",
      price: 15,
      validity: "até domingo",
      scopeConfirmed: true,
    });
    expect(turn.nextQuestion).toBeNull();
  });

  it("resolves a natural answer to the pending subject question without repeating it", () => {
    const firstTurn = resolveBannerConversationTurn({}, ["Como criar um banner de promoção"]);
    expect(firstTurn.brief.pendingQuestion).toBe("subject");
    expect(firstTurn.nextQuestion).toMatch(/produto, serviço ou condição/i);

    const secondTurn = resolveBannerConversationTurn(firstTurn.brief, [
      "Como criar um banner de promoção",
      "Festival de sopas, na quarta feira",
    ]);
    expect(secondTurn.newFacts).toMatchObject({
      subject: "Festival de sopas",
      weekday: "quarta-feira",
    });
    expect(secondTurn.brief).toMatchObject({
      subject: "Festival de sopas",
      weekday: "quarta-feira",
      recurrence: "NONE",
    });
    expect(secondTurn.brief.validity).toBeUndefined();
    expect(secondTurn.brief.pendingQuestion).toBe("price_confirmation");
    expect(
      secondTurn.nextQuestion === null ||
        !/produto, serviço ou condição/i.test(secondTurn.nextQuestion),
    ).toBe(true);
  });

  it.each([
    [
      "restaurante",
      "Festival de sopas, na quarta feira",
      { subject: "Festival de sopas", weekday: "quarta-feira" },
    ],
    [
      "oficina",
      "Alinhamento e balanceamento por 99 reais",
      { subject: "Alinhamento e balanceamento", price: 99 },
    ],
    ["salão", "Dia da noiva sábado", { subject: "Dia da noiva", weekday: "sábado" }],
    [
      "academia",
      "Aulão de funcional domingo às 9",
      { subject: "Aulão de funcional", weekday: "domingo", time: "09:00" },
    ],
    ["pet shop", "Banho e tosa 70 pila", { subject: "Banho e tosa", price: 70 }],
    [
      "hotel",
      "Pacote romântico neste fim de semana",
      { subject: "Pacote romântico", validity: "neste fim de semana" },
    ],
    [
      "loja",
      "Todos os tênis com 20% de desconto",
      { subject: "Todos os tênis com 20% de desconto", commercialCondition: "20% de desconto" },
    ],
    [
      "clínica",
      "Avaliação gratuita durante setembro",
      { subject: "Avaliação gratuita", commercialCondition: "gratuita", validity: "setembro" },
    ],
  ] as const)(
    "extracts universal facts for %s without a segment catalog",
    (_segment, message, expected) => {
      expect(extractBannerTurnFacts(message, { pendingQuestion: "subject" })).toMatchObject(
        expected,
      );
    },
  );

  it.each([
    "festival de sopas quarta",
    "festival de sopas na quarta feira",
    "quarta vai ter festival de sopas",
    "queria divulgar nosso festival de sopas dessa quarta",
    "faz um banner pro festival de sopas de quarta",
  ])("keeps the subject when Portuguese is natural: %s", (message) => {
    const facts = extractBannerTurnFacts(message, { pendingQuestion: "subject" });
    expect(facts.subject?.toLocaleLowerCase("pt-BR")).toContain("festival de sopas");
    expect(facts.weekday).toBe("quarta-feira");
  });

  it("does not ask scope for an explicit high-confidence combo in one turn", () => {
    const turn = resolveBannerConversationTurn({}, [
      "promoção da semana: bolo de cenoura com cobertura de chocolate + café passado por 15 pila, até domingo",
    ]);
    expect(turn.brief).toMatchObject({ price: 15, validity: "até domingo" });
    expect(turn.nextQuestion).toBeNull();
  });

  it("asks a contextual scope question only for materially ambiguous pricing", () => {
    const turn = resolveBannerConversationTurn({}, ["bolo 15 reais e café", "até domingo"]);
    expect(turn.nextQuestion).toMatch(/R\$ 15,00.*bolo.*caf[eé]/i);
    expect(turn.nextQuestion).not.toBe("Esse valor é referente à oferta completa?");
  });

  it.each(["isso", "sim", "pode ser"])(
    "does not erase prior facts when the next response is %s",
    (reply) => {
      const turn = resolveBannerConversationTurn(
        { subject: "troca de óleo", price: 129, validity: "até domingo", scopeConfirmed: true },
        ["Quero uma promoção da semana para troca de óleo por 129 reais", "até domingo", reply],
      );
      expect(turn.brief).toMatchObject({
        subject: "troca de óleo",
        price: 129,
        validity: "até domingo",
        scopeConfirmed: true,
      });
      expect(turn.nextQuestion).toBeNull();
    },
  );

  it("replaces a price only when the user explicitly corrects it", () => {
    const turn = resolveBannerConversationTurn(
      { subject: "troca de óleo", price: 15, validity: "até domingo", scopeConfirmed: true },
      ["na verdade é 17 reais"],
    );
    expect(turn.brief).toMatchObject({ price: 17, validity: "até domingo" });
  });

  it("accepts a free offer as a confirmed commercial price", () => {
    const turn = resolveBannerConversationTurn(
      { subject: "feijoada por conta da casa", offerItems: ["feijoada"], validity: "até domingo" },
      ["será grátis"],
    );
    expect(turn.brief).toMatchObject({ price: 0, validity: "até domingo" });
    expect(turn.nextQuestion).toBeNull();
  });

  it("understands 'por conta da casa' as a free price while retaining the described dish", () => {
    const turn = resolveBannerConversationTurn(
      {},
      [
        "Criar um banner de promoção do dia",
        "Será servido polenta com galinha por conta da casa",
      ],
    );

    expect(turn.brief).toMatchObject({
      subject: "Será servido polenta com galinha",
      offerItems: ["Será servido polenta com galinha"],
      price: 0,
      commercialCondition: "por conta da casa",
    });
    expect(turn.nextQuestion).toBeNull();
  });

  it("treats 'grátis' as a confirmed zero price, never as a new offer subject", () => {
    const turn = resolveBannerConversationTurn(
      {
        subject: "polenta com galinha",
        offerItems: ["polenta com galinha"],
        pendingQuestion: "price_confirmation",
      },
      ["grátis"],
    );

    expect(turn.brief).toMatchObject({ subject: "polenta com galinha", price: 0 });
    expect(turn.brief.priceCandidate).toBeUndefined();
    expect(turn.nextQuestion).toBeNull();
  });

  it("asks for confirmation before treating a bare number as a promotion price", () => {
    const candidate = resolveBannerConversationTurn(
      { subject: "festival de assados", validity: "para a semana" },
      ["35"],
    );
    expect(candidate.brief).toMatchObject({ priceCandidate: 35, pendingQuestion: "price_confirmation" });
    expect(candidate.nextQuestion).toMatch(/R\$ 35,00.*valor da oferta/i);

    const confirmed = resolveBannerConversationTurn(candidate.brief, ["isso, exato"]);
    expect(confirmed.brief).toMatchObject({ price: 35, validity: "para a semana" });
    expect(confirmed.brief.priceCandidate).toBeUndefined();
    expect(confirmed.nextQuestion).toBeNull();
  });

  it("understands a festival as a temporal commercial action before asking its price", () => {
    let turn = resolveBannerConversationTurn({}, ["Festival de assados"]);
    expect(turn.nextQuestion).toMatch(/dia específico|durante a semana|período definido/i);
    expect(turn.brief.pendingQuestion).toBeUndefined();

    turn = resolveBannerConversationTurn(turn.brief, ["Festival de assados", "toda quinta-feira"]);
    expect(turn.brief).toMatchObject({ weekday: "quinta-feira", recurrence: "WEEKLY" });
    expect(turn.nextQuestion).toMatch(/valor exato/i);
    expect(turn.brief.pendingQuestion).toBe("price_confirmation");
  });

  it("does not convert a bare number into a price after the user rejects it", () => {
    const rejected = resolveBannerConversationTurn(
      {
        subject: "festival de sopas",
        validity: "para a semana",
        priceCandidate: 35,
        pendingQuestion: "price_confirmation",
      },
      ["não"],
    );
    expect(rejected.brief.price).toBeUndefined();
    expect(rejected.brief.priceCandidate).toBeUndefined();
    expect(rejected.nextQuestion).toMatch(/valor exato/i);
  });

  it("uses the active brief when filtering a repeated model question", () => {
    const brief = {
      subject: "bolo de cenoura e café passado",
      price: 15,
      validity: "até domingo",
      scopeConfirmed: true,
    };
    expect(
      isResolvedQuestion("Qual é o valor exato da oferta?", ["sim, os dois fazem parte"], brief),
    ).toBe(true);
  });

  it.each(["sim", "isso", "pode ser", "isso mesmo", "confirmo"])(
    "resolves the pending offer scope confirmation with %s",
    (reply) => {
      const turn = resolveBannerConversationTurn(
        {
          subject: "bolo de cenoura com cobertura de chocolate e café passado",
          price: 15,
          validity: "até domingo",
          pendingQuestion: "offer_scope_confirmation",
        },
        [reply],
      );
      expect(turn.brief).toMatchObject({
        price: 15,
        validity: "até domingo",
        scopeConfirmed: true,
      });
      expect(turn.brief.pendingQuestion).toBeUndefined();
      expect(turn.nextQuestion).toBeNull();
    },
  );

  it("does not infer scope from sim without a pending semantic question", () => {
    const turn = resolveBannerConversationTurn(
      { subject: "bolo de cenoura", price: 15, validity: "até domingo" },
      ["sim"],
    );
    expect(turn.brief.scopeConfirmed).toBeUndefined();
  });

  it.each([
    ["não, é só o bolo", "bolo de cenoura com cobertura de chocolate"],
    ["sem o café", "bolo de cenoura com cobertura de chocolate"],
    ["só o primeiro item", "bolo de cenoura com cobertura de chocolate"],
    ["apenas o bolo", "bolo de cenoura com cobertura de chocolate"],
    ["somente o primeiro", "bolo de cenoura com cobertura de chocolate"],
    ["tira o café", "bolo de cenoura com cobertura de chocolate"],
    ["remove o segundo item", "bolo de cenoura com cobertura de chocolate"],
  ])("resolves a negative scope correction from %s", (reply, expectedSubject) => {
    const turn = resolveBannerConversationTurn(
      {
        subject: "bolo de cenoura com cobertura de chocolate e café passado",
        price: 15,
        validity: "até domingo",
        pendingQuestion: "offer_scope_confirmation",
      },
      [reply],
    );
    expect(turn.brief).toMatchObject({
      subject: expectedSubject,
      price: 15,
      validity: "até domingo",
      scopeConfirmed: true,
    });
    expect(turn.brief.offerItems).toEqual([expectedSubject]);
    expect(turn.brief.pendingQuestion).toBeUndefined();
    expect(turn.nextQuestion).toBeNull();
  });

  it("turns a bare negative into a useful correction question instead of repeating confirmation", () => {
    const turn = resolveBannerConversationTurn(
      {
        subject: "bolo de cenoura com cobertura de chocolate e café passado",
        offerItems: ["bolo de cenoura com cobertura de chocolate", "café passado"],
        price: 15,
        validity: "até domingo",
        pendingQuestion: "offer_scope_confirmation",
      },
      ["não"],
    );
    expect(turn.brief.pendingQuestion).toBe("offer_scope_correction");
    expect(turn.nextQuestion).toContain("vale só para qual item");
    expect(turn.nextQuestion).not.toContain("referente à oferta completa");
  });

  it("rebuilds required facts from the live brief after removing an item without a pending question", () => {
    const turn = resolveBannerConversationTurn(
      {
        subject: "bolo de cenoura com cobertura de chocolate e café passado",
        offerItems: ["bolo de cenoura com cobertura de chocolate", "café passado"],
        price: 15,
        validity: "até domingo",
        scopeConfirmed: true,
      },
      ["sem o café"],
    );
    expect(turn.brief.offerItems).toEqual(["bolo de cenoura com cobertura de chocolate"]);
    expect(requiredOfferFactsFromBrief(turn.brief, "Campos")).toEqual({
      items: ["bolo de cenoura com cobertura de chocolate"],
      price: 15,
      validity: "até domingo",
      business: "Campos",
      scope: "confirmed",
    });
  });

  it("keeps only the latest facts across scope, price and validity amendments", () => {
    let brief = {
      subject: "bolo de cenoura com cobertura de chocolate e café passado",
      offerItems: ["bolo de cenoura com cobertura de chocolate", "café passado"],
      price: 15,
      validity: "até domingo",
      scopeConfirmed: true,
    };
    brief = resolveBannerConversationTurn(brief, ["sem o café"]).brief as typeof brief;
    brief = resolveBannerConversationTurn(brief, ["na verdade coloca o café de volta"])
      .brief as typeof brief;
    brief = resolveBannerConversationTurn(brief, ["o preço agora é 17"]).brief as typeof brief;
    brief = resolveBannerConversationTurn(brief, ["vai até sábado"]).brief as typeof brief;
    expect(requiredOfferFactsFromBrief(brief)).toMatchObject({
      items: ["bolo de cenoura com cobertura de chocolate", "café"],
      price: 17,
      validity: "até sábado",
    });
  });
});
