import { OperationalUnitStatus } from "@/components/app/operational/OperationalUnitCard";

/**
 * Normaliza o status operacional para um padrão interno único.
 */
export function normalizeOperationalStatus(
  status: string | null | undefined,
): OperationalUnitStatus {
  if (!status) return "estavel";

  const s = status.toLowerCase().trim();

  if (s === "observacao" || s === "observation" || s === "em_observacao" || s === "em observação") {
    return "observacao";
  }

  if (s === "destaque" || s === "highlight") {
    return "destaque";
  }

  if (s === "atencao" || s === "atenção" || s === "attention") {
    return "atencao";
  }

  if (s === "critico" || s === "crítico" || s === "critical") {
    return "critico";
  }

  return "estavel";
}
