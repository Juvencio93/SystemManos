import { tavily } from "@tavily/core";

export type CompanyEnvironmentProfile = {
  name: string;
  tradeName?: string | null;
  legalName?: string | null;
  segment?: string | null;
  description?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export type EnvironmentConfidence = "confirmado" | "parcial" | "nao_confirmado";

export type CompanyEnvironmentResearch = {
  ok: boolean;
  confidence: EnvironmentConfidence;
  context: string;
  sources: string[];
};

const IDENTITY_STOP_WORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "empresa",
  "ltda",
  "me",
  "o",
  "os",
  "sa",
]);

function normalizeSearchText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function identityTokens(profile: CompanyEnvironmentProfile) {
  const aliases = [profile.tradeName, profile.name, profile.legalName]
    .map(normalizeSearchText)
    .filter(Boolean);

  return Array.from(
    new Set(
      aliases
        .flatMap((alias) => alias.split(" "))
        .filter((token) => token.length >= 3 && !IDENTITY_STOP_WORDS.has(token)),
    ),
  );
}

function identityMatchStrength(
  title: string,
  content: string,
  profile: CompanyEnvironmentProfile,
): "strong" | "weak" | "none" {
  const haystack = normalizeSearchText(`${title} ${content}`);
  const tokens = identityTokens(profile);
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  const normalizedCity = normalizeSearchText(profile.city);
  // cityMatches só é true se a cidade de fato aparece no texto (ou não há cidade no cadastro)
  const cityMatches = !normalizedCity || haystack.includes(normalizedCity);
  const normalizedAddress = normalizeSearchText(profile.address);
  const addressTokens = normalizedAddress
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 3);
  const addressMatches =
    addressTokens.length > 0 && addressTokens.filter((token) => haystack.includes(token)).length >= 2;

  if (matchedTokens.length === 0) return "none";

  // Strong: pelo menos 40% dos tokens de identidade matcharam E cidade/endereço confirmam.
  // Threshold reduzido de 60% para 40% para cobrir nomes curtos (ex: "Panificadora Campos").
  // Um único site oficial com nome + cidade já é suficiente para "strong".
  const strongTokenCoverage = matchedTokens.length >= Math.max(1, Math.ceil(tokens.length * 0.4));
  if (strongTokenCoverage && (cityMatches || addressMatches)) return "strong";

  // Weak: algum sinal de identidade, mas sem corroboração por cidade/endereço —
  // precisa de segunda fonte independente para ser "confirmado".
  if (matchedTokens.length >= 1) return "weak";

  return "none";
}

// needsCompanyEnvironmentResearch foi removida — Tavily agora roda sempre (sem condicional).

// Exportada somente para testes unitários — não usar em produção diretamente.
export const identityMatchStrengthTest = identityMatchStrength;

export async function searchCompanyEnvironment(
  profile: CompanyEnvironmentProfile,
): Promise<CompanyEnvironmentResearch> {
  const apiKey = process.env["TAVILY_API_KEY"];
  if (!apiKey) {
    return { ok: false, confidence: "nao_confirmado", context: "", sources: [] };
  }

  const identity = profile.tradeName || profile.name || profile.legalName;
  const location = [profile.address, profile.neighborhood, profile.city, profile.state]
    .filter(Boolean)
    .join(", ");
  const query = [
    `"${identity}"`,
    location,
    profile.segment,
    "site oficial Instagram Facebook fotos ambiente interior fachada",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const tvly = tavily({ apiKey });
    const result = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 6,
      includeImages: true,
      includeImageDescriptions: true,
    });

    const scoredResults = result.results
      .map((item) => ({ item, strength: identityMatchStrength(item.title, item.content, profile) }))
      .filter((entry) => entry.strength !== "none")
      .sort((a, b) => b.item.score - a.item.score);

    const hasStrong = scoredResults.some((entry) => entry.strength === "strong");
    // Regra de duas fontes: sem um match forte (site/rede oficial), só
    // tratamos como confirmado se pelo menos duas fontes independentes
    // concordarem na identidade.
    const confidence: EnvironmentConfidence = hasStrong
      ? "confirmado"
      : scoredResults.length >= 2
        ? "confirmado"
        : scoredResults.length === 1
          ? "parcial"
          : "nao_confirmado";

    const matchingResults = scoredResults.slice(0, 4).map((entry) => entry.item);

    if (confidence === "nao_confirmado") {
      return { ok: true, confidence, context: "", sources: [] };
    }

    const sources = matchingResults.map((item) => item.url);
    const sourceContext = matchingResults
      .map(
        (item, index) =>
          `Fonte ${index + 1}: ${item.title}\nURL: ${item.url}\nTrecho público: ${item.content}`,
      )
      .join("\n\n");
    const imageContext =
      confidence === "confirmado"
        ? result.images
            .filter((image) =>
              image.description
                ? identityMatchStrength(image.description, image.description, profile) !== "none"
                : false,
            )
            .slice(0, 4)
            .map((image, index) => `Referência visual ${index + 1}: ${image.description}\nURL: ${image.url}`)
            .join("\n\n")
        : "";

    return {
      ok: true,
      confidence,
      sources,
      context: [sourceContext, imageContext].filter(Boolean).join("\n\n"),
    };
  } catch (error) {
    console.error("[Tavily] Company environment search failed:", error);
    return { ok: false, confidence: "nao_confirmado", context: "", sources: [] };
  }
}

export async function searchWeb(query: string) {
  try {
    const tvly = tavily({ apiKey: process.env["TAVILY_API_KEY"] || "" });
    const result = await tvly.search(query, {
      searchDepth: "advanced",
      maxResults: 3,
    });
    
    const context = result.results
      .map((r) => `Título: ${r.title}\nConteúdo: ${r.content}\nURL: ${r.url}`)
      .join("\n\n");

    return {
      ok: true,
      context,
    };
  } catch (error) {
    console.error("[Tavily] Search failed:", error);
    return { ok: false };
  }
}

