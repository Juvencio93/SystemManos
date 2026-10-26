const GENERIC_BUSINESS_AREAS = /^(?:outro|outros|n[aã]o informado|n[aã]o cadastrada?)$/iu;

/** Prefer a specific registered activity over generic profile choices such as "Outro". */
export function resolveBusinessArea(...candidates: (string | null | undefined)[]) {
  const normalized = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return (
    normalized.find((value) => !GENERIC_BUSINESS_AREAS.test(value)) ??
    normalized[0] ??
    null
  );
}

/**
 * Rótulo amigável para exibição: descrições de CNAE são burocráticas
 * ("Atividades de organizações religiosas ou filosóficas") e caem mal
 * numa saudação ao cliente. Só reescreve descrições conhecidas; qualquer
 * outro texto passa intacto, e o cadastro original nunca é alterado.
 */
const FRIENDLY_BUSINESS_AREAS: Record<string, string> = {
  "atividades de organizações religiosas ou filosóficas": "Igreja",
  "restaurantes e similares": "Restaurante",
  "lanchonetes, casas de chá, de sucos e similares": "Lanchonete",
  "padaria e confeitaria com predominância de revenda": "Padaria e Confeitaria",
  "hotéis": "Hotel",
  "atividades de condicionamento físico": "Academia",
  "cabeleireiros, manicure e pedicure": "Salão de beleza",
  "atividades de estética e outros serviços de cuidados com a beleza": "Estética",
  "comércio varejista de artigos do vestuário e acessórios": "Loja de roupas",
  "bares e outros estabelecimentos especializados em servir bebidas, sem entretenimento":
    "Bar",
  "comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados":
    "Supermercado",
};

export function friendlyBusinessArea(segment: string | null | undefined): string | null {
  if (!segment) return null;
  const key = segment.trim().toLowerCase().replace(/\s+/g, " ");
  return FRIENDLY_BUSINESS_AREAS[key] ?? segment;
}
