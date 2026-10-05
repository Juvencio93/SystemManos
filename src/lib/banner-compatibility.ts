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

const CLEAR_BUSINESS_DOMAINS = [
  {
    name: "padaria/confeitaria",
    displayName: "uma padaria ou confeitaria",
    profile: /\b(?:padaria|panificadora|panifica[cç][aã]o|confeitaria)\b/iu,
    subject: /\b(?:p[aã]o\s+franc[eê]s|p[aã]o\s+de\s+queijo|bolo|torta|doces?|confeitaria|caf[eé])\b/iu,
  },
  {
    name: "restaurante/bar",
    displayName: "um restaurante ou bar",
    profile: /\b(?:restaurante|bar|boteco|bistr[oô]|buffet|gastronomia)\b/iu,
    subject: /\b(?:feijoada|churrasco|marmita|prato\s+feito|almo[cç]o\s+executivo|jantar\s+executivo|petiscos?)\b/iu,
  },
  {
    name: "construção",
    displayName: "construção ou materiais de construção",
    profile: /\b(?:construtora|constru[cç][aã]o|materiais?\s+de\s+constru[cç][aã]o|engenharia\s+civil)\b/iu,
    subject: /\b(?:cimento|tijolos?|telhas?|reforma|obra|material\s+de\s+constru[cç][aã]o|engenharia\s+civil)\b/iu,
  },
  {
    name: "saúde",
    displayName: "saúde",
    profile: /\b(?:cl[ií]nica|consult[oó]rio|hospital|odontologia|dentista|farm[aá]cia)\b/iu,
    subject: /\b(?:consulta\s+m[eé]dica|avalia[cç][aã]o\s+odontol[oó]gica|aparelho\s+ortod[oô]ntico|exame\s+cl[ií]nico|medicamento)\b/iu,
  },
  {
    name: "beleza",
    displayName: "beleza e estética",
    profile: /\b(?:sal[aã]o\s+de\s+beleza|barbearia|manicure|est[eé]tica|cabeleireir[oa])\b/iu,
    subject: /\b(?:corte\s+de\s+cabelo|manicure|pedicure|design\s+de\s+sobrancelha|procedimento\s+est[eé]tico)\b/iu,
  },
] as const;

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

  const companyDomain = CLEAR_BUSINESS_DOMAINS.find((domain) => domain.profile.test(profile));
  const requestedDomain = CLEAR_BUSINESS_DOMAINS.find((domain) => domain.subject.test(subject));
  if (companyDomain && requestedDomain && companyDomain.name !== requestedDomain.name) {
    return {
      classification: "STRONG_MISMATCH",
      reason: `O cadastro indica ${companyDomain.name}, enquanto o pedido descreve uma oferta de ${requestedDomain.name}.`,
    };
  }

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

export function compatibilityConfirmationQuestion(
  company: BannerCompanyContext,
  subject?: string,
) {
  const name = company.name?.trim() || "empresa cadastrada";
  const segment = company.segment?.trim() || "cadastro atual";
  const profile = [company.name, company.segment, company.description, company.products]
    .filter(Boolean)
    .join(" ");
  const companyDomain = CLEAR_BUSINESS_DOMAINS.find((domain) => domain.profile.test(profile));
  const requestDomain = CLEAR_BUSINESS_DOMAINS.find((domain) => domain.subject.test(subject ?? ""));
  if (companyDomain && requestDomain && companyDomain.name !== requestDomain.name) {
    return `Esse banner é mesmo para ${name}? Pelo cadastro, a empresa atua em ${companyDomain.displayName}, enquanto ${subject} parece ser uma oferta de ${requestDomain.displayName}. Se for uma ação especial dessa empresa, me confirma para eu continuar.`;
  }
  const readableSegment = /^(?:outro|outros|n[aã]o informado|n[aã]o cadastrad[oa])$/iu.test(segment)
    ? "o ramo identificado no nome e na descrição do cadastro"
    : segment;
  return `Esse banner é mesmo para ${name}? O cadastro indica ${readableSegment}, mas o pedido parece ser de outro ramo. Se for uma ação especial dessa empresa, me confirma para eu continuar.`;
}
