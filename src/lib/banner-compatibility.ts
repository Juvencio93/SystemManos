/**
 * Segment is context, never a product whitelist.  This deliberately only
 * raises a strong mismatch when the request itself names a clearly distinct
 * technical trade and the complete company profile offers no evidence for it.
 * Every ordinary event, service, launch or themed promotion remains allowed.
 */
export type BannerCompatibility =
  "DIRECT_MATCH" | "PLAUSIBLE_EXTENSION" | "UNCERTAIN" | "STRONG_MISMATCH";

export type BannerCompanyContext = {
  name?: string | null | undefined;
  segment?: string | null | undefined;
  description?: string | null | undefined;
  products?: string | null | undefined;
  location?: string | null | undefined;
};

export type BannerCompatibilityResult = {
  classification: BannerCompatibility;
  reason: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function meaningfulTerms(value: string) {
  return (
    normalize(value)
      .match(/[\p{L}\p{N}]{4,}/gu)
      ?.map((term) => term.replace(/s$/u, ""))
      .filter(
        (term) =>
          !["para", "com", "esta", "esse", "nesta", "neste", "quarta", "feira"].includes(term),
      ) ?? []
  );
}

/**
 * This is not a catalog of products by segment. It recognizes an explicit
 * technical automotive-service claim, which is strong evidence only when the
 * complete registered business context contains no automotive evidence.
 */
function namesAutomotiveService(value: string) {
  return /\b(?:troca\s+de\s+[óo]leo|alinhamento|balanceamento|motor|ve[ií]culo|automotiv|pneu|oficina)\b/iu.test(
    value,
  );
}

export function classifyBannerCompatibility(
  company: BannerCompanyContext,
  subject: string | undefined,
): BannerCompatibilityResult {
  if (!subject?.trim())
    return { classification: "UNCERTAIN", reason: "Assunto ainda não informado." };

  const profile = [
    company.name,
    company.segment,
    company.description,
    company.products,
    company.location,
  ]
    .filter(Boolean)
    .join(" ");
  const profileTerms = new Set(meaningfulTerms(profile));
  const overlap = meaningfulTerms(subject).some((term) => profileTerms.has(term));
  if (overlap)
    return {
      classification: "DIRECT_MATCH",
      reason: "O assunto encontra evidência no cadastro completo.",
    };

  if (namesAutomotiveService(subject) && !namesAutomotiveService(profile)) {
    return {
      classification: "STRONG_MISMATCH",
      reason:
        "O pedido descreve serviço automotivo, sem evidência automotiva no cadastro completo.",
    };
  }

  return {
    classification: "PLAUSIBLE_EXTENSION",
    reason: "O assunto pode ser uma extensão comercial, evento ou ação temporária do negócio.",
  };
}

export function compatibilityConfirmationQuestion(company: BannerCompanyContext) {
  const name = company.name?.trim() || "empresa cadastrada";
  const segment = company.segment?.trim() || "cadastro atual";
  return `Esse banner é mesmo para ${name}? O cadastro atual indica ${segment}, mas o pedido parece ser de outro ramo.`;
}
