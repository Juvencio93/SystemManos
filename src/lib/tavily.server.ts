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
  publicLinks?: string[];
};

export type CompanyEnvironmentResearch = {
  ok: boolean;
  verified: boolean;
  researchState: "NOT_CONFIGURED" | "FAILED" | "NO_MATCH" | "MATCHED_NO_VISUAL" | "VISUALS_FOUND";
  /** True only when an official or corroborated source explicitly describes
   * a visual/material characteristic of this exact establishment. */
  hasVisualEvidence: boolean;
  visualGuidance: string | null;
  context: string;
  sources: string[];
};

const VISUAL_EVIDENCE_TERMS =
  /\b(?:ambiente|interior|fachada|sal[aã]o|balc[aã]o|vitrine|mesa|madeira|cer[aâ]mica|ilumina[çc][aã]o|decora[çc][aã]o|arquitetura|paredes?|janelas?|lumin[aá]rias?|cadeiras?|bancos?|cores?|tons?|paleta|texturas?|materiais?|pedra|tijolo|metal|vidro|minimalista|r[uú]stic[oa]|industrial|contempor[aâ]neo|cl[aá]ssico|colorido|elegante)\b/iu;

const NON_VISUAL_OR_SENSITIVE_TERMS =
  /\b(?:cnpj|cpf|receita\s+federal|informa[cç][õo]es?\s+(?:de\s+)?registro|dados?\s+cadastrais?|situa[cç][aã]o\s+cadastral|capital\s+social|natureza\s+jur[ií]dica|porte\s+(?:da\s+)?empresa|simples\s+nacional|regime\s+tribut[aá]rio|data\s+da\s+abertura|s[oó]ci[oa]s?|administrador(?:es)?|telefone(?:s)?|whats?app|e-?mail|contatos?|logradouro|bairro|munic[ií]pio|cep|cnae|inscri[cç][aã]o|atividade\s+principal|atividade\s+econ[oô]mica|compartilhar|fa[cç]a\s+sua\s+busca|faq|pricing|excel\s+add-?in|bulk\s+lookup|member\s+search|outras\s+empresas|empresas\s+(?:relacionadas|semelhantes|pr[oó]ximas)|(?:ltda|eireli|s\/a|s\.a\.|\bme\b))\b/iu;

/** Keep only source sentences that actually support an art-direction detail.
 * Search identity alone must never be treated as proof of a physical setting. */
export function extractVisualEvidence(text: string) {
  return text
    .replace(/<[^>]*>/gu, " ")
    .replace(/&(?:nbsp|amp|quot|#\d+);/giu, " ")
    .split(/(?<=[.!?;])\s+|[\r\n|]+/u)
    .map((sentence) => sentence.replace(/^[\s#>*•-]+/u, "").replace(/\s+/gu, " ").trim())
    .filter(
      (sentence) =>
        sentence.length >= 24 &&
        sentence.length <= 280 &&
        !NON_VISUAL_OR_SENSITIVE_TERMS.test(sentence) &&
        !/https?:\/\/|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu.test(sentence) &&
        VISUAL_EVIDENCE_TERMS.test(sentence),
    )
    .slice(0, 3);
}

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

/** Official links are often saved in the business description rather than a
 * dedicated field. Treat them as identity evidence, never as instructions. */
function registeredPublicLinks(profile: CompanyEnvironmentProfile) {
  const fromDescription = profile.description?.match(/https?:\/\/[^\s,)>]+/giu) ?? [];
  return Array.from(new Set([...(profile.publicLinks ?? []), ...fromDescription]));
}

const SOCIAL_DOMAINS = new Set([
  "instagram.com",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "youtube.com",
]);

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, "");
  } catch {
    return "";
  }
}

function hasExactSocialIdentity(title: string, _content: string, url: string, profile: CompanyEnvironmentProfile) {
  const identity = normalizeSearchText(profile.tradeName || profile.name);
  if (!identity || identity.length < 5 || !SOCIAL_DOMAINS.has(hostOf(url))) return false;
  const identityCompact = identity.replace(/\s+/gu, "");
  // A mention in a post does not prove the post belongs to the business.
  // Require the exact trade name in the social profile title or profile URL.
  const haystack = normalizeSearchText(`${title} ${url}`);
  const compactHaystack = haystack.replace(/\s+/gu, "");
  return haystack.includes(identity) || compactHaystack.includes(identityCompact);
}

export function isIdentityMatch(
  title: string,
  content: string,
  profile: CompanyEnvironmentProfile,
  url = "",
) {
  const haystack = normalizeSearchText(`${title} ${content} ${url}`);
  const tokens = identityTokens(profile);
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  const normalizedCity = normalizeSearchText(profile.city);
  const cityMatches = Boolean(normalizedCity && haystack.includes(normalizedCity));
  const normalizedAddress = normalizeSearchText(profile.address);
  const addressTokens = normalizedAddress
    .split(" ")
    .filter((token) => token.length >= 4)
    .slice(0, 3);
  const addressMatches =
    addressTokens.length > 0 &&
    addressTokens.filter((token) => haystack.includes(token)).length >= 2;

  return (
    matchedTokens.length >= Math.min(2, Math.max(1, tokens.length)) &&
    (cityMatches || addressMatches)
  ) || hasExactSocialIdentity(title, content, url, profile);
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
    return {
      ok: false,
      verified: false,
      researchState: "NOT_CONFIGURED",
      hasVisualEvidence: false,
      visualGuidance: null,
      context: "",
      sources: [],
    };
  }

  const identity = profile.tradeName || profile.name || profile.legalName;
  const publicLinks = registeredPublicLinks(profile);
  const location = [profile.address, profile.neighborhood, profile.city, profile.state]
    .filter(Boolean)
    .join(", ");
  const query = [
    `"${identity}"`,
    location,
    profile.segment,
    ...publicLinks.slice(0, 5),
    "site oficial fotos fachada interior identidade visual cores decoração ambiente",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const tvly = tavily({ apiKey });
    const socialQuery = [
      `"${identity}"`,
      location,
      "Instagram Facebook TikTok fotos ambiente fachada salão identidade visual decoração",
    ]
      .filter(Boolean)
      .join(" ");
    const baseOptions = {
      timeout: 12,
      searchDepth: "advanced" as const,
      includeImages: true,
      includeImageDescriptions: true,
      country: "brazil",
    };
    const searches = [
      tvly.search(query, { ...baseOptions, maxResults: 6 }),
      tvly.search(socialQuery, {
        ...baseOptions,
        maxResults: 5,
        includeDomains: [...SOCIAL_DOMAINS],
        includeDomainsMode: "prefer",
      }),
    ];
    const registeredWebsite = publicLinks.find((link) => {
      try {
        return !SOCIAL_DOMAINS.has(new URL(link).hostname.toLowerCase().replace(/^www\./u, ""));
      } catch {
        return false;
      }
    });
    if (registeredWebsite) {
      const host = new URL(registeredWebsite).hostname.replace(/^www\./u, "");
      searches.push(
        tvly.search(`"${identity}" ${location} fotos identidade visual`, {
          ...baseOptions,
          maxResults: 4,
          includeDomains: [host],
          includeDomainsMode: "prefer",
        }),
      );
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const results = await Promise.race([
      Promise.allSettled(searches),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("TAVILY_TIMEOUT")), 12000);
      }),
    ]).finally(() => clearTimeout(timeout));
    const searchResults = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const mergedResults = Array.from(
      new Map(
        searchResults.flatMap((result) => result.results).map((item) => [item.url, item]),
      ).values(),
    );

    const isOfficial = (url: string) =>
      publicLinks.some((link) => {
        try {
          const saved = new URL(link),
            found = new URL(url);
          const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
          if (host(saved) !== host(found)) return false;
          // Sharing instagram.com/facebook.com never establishes account identity.
          const path = saved.pathname.replace(/\/$/, "");
          if (SOCIAL_DOMAINS.has(host(saved))) {
            return (
              path.length > 1 && (found.pathname === path || found.pathname.startsWith(path + "/"))
            );
          }
          return true;
        } catch {
          return false;
        }
      });

    const matchingResults = mergedResults
      .filter((item) => isIdentityMatch(item.title, item.content, profile, item.url) || isOfficial(item.url))
      .sort((a, b) => Number(isOfficial(b.url)) - Number(isOfficial(a.url)) || b.score - a.score)
      .slice(0, 8);
    const domains = new Set(
      matchingResults.flatMap((item) => {
        try {
          return [new URL(item.url).hostname.replace(/^www\./, "")];
        } catch {
          return [];
        }
      }),
    );
    const hasStrongSocialMatch = matchingResults.some((item) =>
      hasExactSocialIdentity(item.title, item.content, item.url, profile),
    );
    const verified =
      matchingResults.some((item) => isOfficial(item.url)) || domains.size >= 2 || hasStrongSocialMatch;

    if (!verified) {
      return {
        ok: true,
        verified: false,
        researchState: "NO_MATCH",
        hasVisualEvidence: false,
        visualGuidance: null,
        context: "",
        sources: [],
      };
    }

    const sources = matchingResults.map((item) => item.url);
    const visualEvidence = matchingResults.flatMap((item) => {
      // A registered official link is sufficient. Other results need the
      // independent-source verification above before they can contribute.
      if (
        !isOfficial(item.url) &&
        domains.size < 2 &&
        !hasExactSocialIdentity(item.title, item.content, item.url, profile)
      ) return [];
      return extractVisualEvidence(item.content).map(
        (sentence) => sentence,
      );
    });
    const imageReferences = matchingResults.flatMap((item) =>
      (item.images ?? []).map((image) => ({
        image,
        sourceUrl: item.url,
        official: isOfficial(item.url),
      })),
    );
    const visualGuidance =
      [
        ...visualEvidence,
        ...imageReferences
          .filter(({ image, official, sourceUrl }) =>
            Boolean(
              image.description &&
                (official || domains.size >= 2 || matchingResults.some((item) => item.url === sourceUrl && hasExactSocialIdentity(item.title, item.content, item.url, profile))),
            ),
          )
          .flatMap(({ image }) => extractVisualEvidence(image.description ?? "")),
      ]
        .filter(Boolean)
        .slice(0, 6)
        .join(" ") || null;

    return {
      ok: true,
      verified: true,
      researchState: visualGuidance ? "VISUALS_FOUND" : "MATCHED_NO_VISUAL",
      hasVisualEvidence: Boolean(visualGuidance),
      visualGuidance,
      sources,
      context: [
        "Pesquisa externa filtrada: foram removidos textos cadastrais, contatos, identificadores, páginas brutas, links e instruções. Use somente as descrições visuais curtas abaixo como referência; não copie o conteúdo de páginas pesquisadas.",
        visualGuidance
          ? `EVIDÊNCIAS VISUAIS CONFIRMADAS: cada opção deve incorporar pelo menos uma característica visual explicitamente descrita; não acrescente outros detalhes locais.\n${visualGuidance}`
          : "Nenhuma característica física do local foi confirmada. Não simule ambiente, fachada ou interior.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  } catch (error) {
    console.error(
      "[Tavily] Company environment search failed:",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      ok: false,
      verified: false,
      researchState: "FAILED",
      hasVisualEvidence: false,
      visualGuidance: null,
      context: "",
      sources: [],
    };
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
