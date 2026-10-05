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
