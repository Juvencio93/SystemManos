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
  const cityMatches = !normalizedCity || haystack.includes(normalizedCity);
  const normalizedAddress = normalizeSearchText(profile.address);
  const addressTokens = normalizedAddress
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 3);
  const addressMatches =
    addressTokens.length > 0 && addressTokens.filter((token) => haystack.includes(token)).length >= 2;

  if (matchedTokens.length === 0) return "none";

  // Strong: most identity tokens matched AND corroborated by city/address —
  // treat as an official-source-grade match (site/redes da própria empresa).
  const strongTokenCoverage = matchedTokens.length >= Math.max(2, Math.ceil(tokens.length * 0.6));
  if (strongTokenCoverage && (cityMatches || addressMatches)) return "strong";

  // Weak: some identity signal, but not enough on its own — needs a second
  // independent source to be treated as confirmed (regra de duas fontes).
  if (matchedTokens.length >= Math.min(2, Math.max(1, tokens.length))) return "weak";

  return "none";
}

export function needsCompanyEnvironmentResearch(profile: CompanyEnvironmentProfile) {
  // A fidelidade visual depende de consultar fontes públicas atuais mesmo
  // quando o cadastro já possui descrição e links. O cadastro orienta a
  // busca; a Tavily confirma o ambiente, fachada e referências visuais reais.
  return Boolean((profile.tradeName || profile.name || profile.legalName || "").trim());
}

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

