import { describe, expect, it } from "vitest";
import {
  detectarSkills,
  detectarSkillsEm,
  formatarSkillsParaPrompt,
  loadBannerSkills,
  BANNER_SKILLS_EMBUTIDAS,
} from "./banner-skills";
import { normalizePrice } from "./banner-brief";
import {
  classifyBannerCompatibility,
  compatibilityConfirmationQuestion,
} from "./banner-compatibility";

describe("banner skills — matching determinístico", () => {
  it("detecta fotografia gastronômica para pedido de restaurante", () => {
    const skills = detectarSkills("Quero um banner de polenta com galinha", "restaurante");
    expect(skills.map((s) => s.nome)).toContain("fotografia-gastronomica");
  });

  it("detecta eventos-festas para música ao vivo", () => {
    const skills = detectarSkills("banner com música ao vivo toda quinta", "bar");
    expect(skills.map((s) => s.nome)).toContain("eventos-festas");
  });

  it("detecta copy-marketing para promoção com preço", () => {
    const skills = detectarSkills("promoção de camisas por 8 pila", "loja de roupas");
    expect(skills.map((s) => s.nome)).toContain("copy-marketing");
  });

  it("limita a no máximo 3 skills", () => {
    const skills = detectarSkills(
      "banner de festa com comida, música ao vivo, promoção de produtos e desconto",
      "restaurante",
    );
    expect(skills.length).toBeLessThanOrEqual(3);
  });

  it("retorna vazio quando nada combina", () => {
    expect(detectarSkills("xyzqwe asdf", "outro")).toEqual([]);
  });

  it("é case-insensitive e ignora acentos", () => {
    const a = detectarSkills("MÚSICA AO VIVO", null);
    const b = detectarSkills("musica ao vivo", null);
    expect(a.map((s) => s.nome)).toEqual(b.map((s) => s.nome));
    expect(a.map((s) => s.nome)).toContain("eventos-festas");
  });

  it("formatarSkillsParaPrompt gera seção de conhecimento", () => {
    const texto = formatarSkillsParaPrompt([BANNER_SKILLS_EMBUTIDAS[0]!]);
    expect(texto).toMatch(/CONHECIMENTO ESPECIALIZADO/);
    expect(texto).toMatch(/fotografia-gastronomica/);
    expect(formatarSkillsParaPrompt([])).toBe("");
  });

  it("loadBannerSkills retorna embutidas quando a tabela não existe", async () => {
    const fakeSupabase = {
      from: () => ({
        select: async () => ({ data: null, error: { message: "relation does not exist" } }),
      }),
    };
    const skills = await loadBannerSkills(fakeSupabase as any);
    expect(skills.length).toBe(BANNER_SKILLS_EMBUTIDAS.length);
  });

  it("loadBannerSkills mescla skills do banco (DB vence por nome)", async () => {
    const fakeSupabase = {
      from: () => ({
        select: async () => ({
          data: [
            {
              nome: "fotografia-gastronomica",
              descricao: "custom",
              gatilhos: ["comida"],
              conteudo: "conteúdo customizado",
              ativa: true,
            },
          ],
          error: null,
        }),
      }),
    };
    const skills = await loadBannerSkills(fakeSupabase as any);
    const gastro = skills.find((s) => s.nome === "fotografia-gastronomica");
    expect(gastro?.conteudo).toBe("conteúdo customizado");
    expect(skills.length).toBe(BANNER_SKILLS_EMBUTIDAS.length);
  });

  it("loadBannerSkills exclui skill desativada", async () => {
    const fakeSupabase = {
      from: () => ({
        select: async () => ({
          data: [{ nome: "fotografia-gastronomica", ativa: false, conteudo: "x" }],
          error: null,
        }),
      }),
    };
    const skills = await loadBannerSkills(fakeSupabase as any);
    expect(skills.find((s) => s.nome === "fotografia-gastronomica")).toBeUndefined();
  });

  it("detectarSkillsEm funciona sobre conjunto customizado", () => {
    const skills = detectarSkillsEm(BANNER_SKILLS_EMBUTIDAS, "show de pagode", null);
    expect(skills.map((s) => s.nome)).toContain("eventos-festas");
  });
});

describe("banner — gírias de valor", () => {
  it.each([
    ["8 pila", 8],
    ["2 barão", 2000],
    ["3 barões", 3000],
    ["1 conto", 1000],
    ["5 contos", 5000],
    ["R$ 10", 10],
  ])("normalizePrice(%s) = %s", (input, expected) => {
    expect(normalizePrice(input)).toBe(expected);
  });
});

describe("banner — interpretação do exemplo do usuário", () => {
  it("entende 'por conta da casa' como gratuito via FREE_OFFER", async () => {
    const { extractBannerTurnFacts } = await import("./banner-brief");
    const facts = extractBannerTurnFacts("Polenta com galinha por conta da casa e música ao vivo");
    expect(facts.price).toBe(0);
    expect(facts.freeCopyConfirmed).toBe(true);
  });

  it("entende 'toda Quinta' como quinta-feira semanal", async () => {
    const { extractBannerTurnFacts } = await import("./banner-brief");
    const facts = extractBannerTurnFacts("isso acontece toda Quinta");
    expect(facts).toMatchObject({ weekday: "quinta-feira", recurrence: "WEEKLY" });
  });
});

describe("banner — validação de segmento (roupa x joias)", () => {
  it("loja de roupas pedindo joias = STRONG_MISMATCH", () => {
    const result = classifyBannerCompatibility(
      {
        name: "Moda Bella",
        segment: "Loja de roupas",
        description: "Vestuário feminino e masculino.",
      },
      "joias na promoção",
    );
    expect(result.classification).toBe("STRONG_MISMATCH");
  });

  it("pergunta de confirmação usa o tom 'não consta no cadastro'", () => {
    const q = compatibilityConfirmationQuestion(
      { name: "Moda Bella", segment: "Loja de roupas" },
      "joias na promoção",
    );
    expect(q).toMatch(/não consta em seu cadastro/i);
  });

  it("joalheria pedindo joias = DIRECT_MATCH", () => {
    const result = classifyBannerCompatibility(
      { name: "Ouro Fino", segment: "Joalheria", description: "Joias em ouro e prata." },
      "aneis de ouro na promoção",
    );
    expect(result.classification).toBe("DIRECT_MATCH");
  });
});

describe("banner — briefing formal", () => {
  it("monta briefing completo a partir da conversa + cadastro", async () => {
    const { montarBriefing, formatarBriefing, extractBannerTurnFacts, rebuildBannerConversationBrief } =
      await import("./banner-brief");
    const brief = rebuildBannerConversationBrief(
      {},
      ["Quero um banner de polenta com galinha por conta da casa e música ao vivo", "isso acontece toda Quinta"],
    );
    const briefing = montarBriefing(brief, {
      nome: "Bar do Zé",
      cores: ["vermelho", "preto"],
      temLogo: true,
    });
    expect(briefing.pronto).toBe(true);
    expect(briefing.faltando).toEqual([]);
    const texto = formatarBriefing(briefing);
    expect(texto).toMatch(/BRIEFING OFICIAL/);
    expect(texto).toMatch(/toda quinta-feira/);
    expect(texto).toMatch(/Bar do Zé/);
  });

  it("briefing indica o que falta quando não há assunto", async () => {
    const { montarBriefing } = await import("./banner-brief");
    const briefing = montarBriefing({}, { nome: "Loja X" });
    expect(briefing.pronto).toBe(false);
    expect(briefing.faltando).toContain("o que será divulgado");
  });

  it("extrai objetivo da mensagem", async () => {
    const { extractBannerTurnFacts } = await import("./banner-brief");
    const facts = extractBannerTurnFacts("quero atrair clientes para minha padaria com um banner");
    expect(facts.objective).toMatch(/atrair/i);
  });
});
