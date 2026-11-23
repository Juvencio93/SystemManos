/**
 * Gatilho de troca de plano do Supabase (Frente 9 da correção de storage).
 *
 * O plano gratuito tem 1 GB de storage, 5 GB de egress e 50 mil MAU —
 * pequeno demais para 500 empresas. A migração para o Pro (US$ 25/mês,
 * 100 GB de storage, 250 GB de egress) acontece quando QUALQUER UM
 * destes gatilhos dispara primeiro:
 *  - storage > 700 MB;
 *  - egress > 3,5 GB/mês;
 *  - empresas ativas > 40.
 *
 * Esta frente é SÓ MONITORAMENTO: o painel mostra o uso atual contra
 * cada gatilho. Nada aqui migra o plano e nada decide a política do
 * spend cap — essa decisão é do Gabriel na hora da migração (o spend
 * cap vem ligado por padrão no Pro e BLOQUEIA o uso acima da quota em
 * vez de cobrar).
 *
 * O egress NÃO tem fonte confiável no código (o número real só existe
 * na página de Uso do Supabase) — o item fica explícito como manual e
 * nenhum número é inventado (ver relatório da revisão geral, seção 6).
 */

import { formatQuotaBytes } from "./company-storage-quota";

/** Gatilho de storage: migrar quando passar de 700 MB. */
export const MAX_FREE_STORAGE_BYTES = 700 * 1024 * 1024;

/** Gatilho de egress: migrar quando passar de 3,5 GB no mês. */
export const MAX_FREE_EGRESS_BYTES_PER_MONTH = 3.5 * 1024 * 1024 * 1024;

/** Gatilho de empresas: migrar quando passar de 40 empresas ativas. */
export const MAX_FREE_ACTIVE_COMPANIES = 40;

/** A partir de 80% do gatilho o item fica "perto" (âmbar). */
export const PLAN_TRIGGER_NEAR_RATIO = 0.8;

export type PlanTriggerState = "ok" | "near" | "triggered" | "unknown" | "manual";

export type PlanTriggerKey = "storage" | "egress" | "companies";

export interface PlanTriggerItem {
  key: PlanTriggerKey;
  /** Nome curto do gatilho, em pt-BR e sem jargão. */
  label: string;
  /** Valor atual formatado, ou null quando não deu para medir. */
  valueText: string | null;
  /** Teto do gatilho formatado. */
  limitText: string;
  /** Fração do gatilho já usada (0–1, pode passar de 1); null sem medição. */
  percent: number | null;
  state: PlanTriggerState;
  /** O que falta para o gatilho, ou o que fazer quando ele dispara. */
  hint: string;
}

export interface PlanTriggerStatus {
  storage: PlanTriggerItem;
  egress: PlanTriggerItem;
  companies: PlanTriggerItem;
  /** Verdadeiro quando QUALQUER gatilho medido já disparou. */
  anyTriggered: boolean;
  measuredAt: string;
}

/** "3,5 GB" / "126,3 MB" / "850 KB" em pt-BR. */
export function formatPlanBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} GB`;
  }
  return formatQuotaBytes(bytes);
}

function stateFor(value: number, limit: number): PlanTriggerState {
  if (value > limit) return "triggered";
  if (value >= limit * PLAN_TRIGGER_NEAR_RATIO) return "near";
  return "ok";
}

/**
 * Transforma os números medidos no estado dos três gatilhos. O gatilho
 * é "maior que" o teto: exatamente no teto ainda é só "perto".
 * Sem medição (`null`) o item fica "unknown" — nunca "ok", para não
 * passar falsa segurança.
 */
export function buildPlanTriggerStatus(input: {
  totalStorageBytes: number | null;
  activeCompanies: number | null;
  measuredAt?: string;
}): PlanTriggerStatus {
  const measuredAt = input.measuredAt ?? new Date().toISOString();

  const storage: PlanTriggerItem =
    input.totalStorageBytes === null
      ? {
          key: "storage",
          label: "Arquivos guardados",
          valueText: null,
          limitText: formatPlanBytes(MAX_FREE_STORAGE_BYTES),
          percent: null,
          state: "unknown",
          hint: "Não foi possível medir no momento.",
        }
      : {
          key: "storage",
          label: "Arquivos guardados",
          valueText: formatPlanBytes(input.totalStorageBytes),
          limitText: formatPlanBytes(MAX_FREE_STORAGE_BYTES),
          percent: input.totalStorageBytes / MAX_FREE_STORAGE_BYTES,
          state: stateFor(input.totalStorageBytes, MAX_FREE_STORAGE_BYTES),
          hint:
            input.totalStorageBytes > MAX_FREE_STORAGE_BYTES
              ? "Acima do gatilho — hora de migrar para o Pro."
              : `Faltam ${formatPlanBytes(MAX_FREE_STORAGE_BYTES - input.totalStorageBytes)} para o gatilho.`,
        };

  const egress: PlanTriggerItem = {
    key: "egress",
    label: "Downloads no mês",
    valueText: null,
    limitText: formatPlanBytes(MAX_FREE_EGRESS_BYTES_PER_MONTH),
    percent: null,
    state: "manual",
    hint: "Conferir na página de Uso do Supabase — o painel não mede este número.",
  };

  const companies: PlanTriggerItem =
    input.activeCompanies === null
      ? {
          key: "companies",
          label: "Empresas ativas",
          valueText: null,
          limitText: String(MAX_FREE_ACTIVE_COMPANIES),
          percent: null,
          state: "unknown",
          hint: "Não foi possível medir no momento.",
        }
      : {
          key: "companies",
          label: "Empresas ativas",
          valueText: String(input.activeCompanies),
          limitText: String(MAX_FREE_ACTIVE_COMPANIES),
          percent: input.activeCompanies / MAX_FREE_ACTIVE_COMPANIES,
          state: stateFor(input.activeCompanies, MAX_FREE_ACTIVE_COMPANIES),
          hint:
            input.activeCompanies > MAX_FREE_ACTIVE_COMPANIES
              ? "Acima do gatilho — hora de migrar para o Pro."
              : `Faltam ${MAX_FREE_ACTIVE_COMPANIES - input.activeCompanies} para o gatilho.`,
        };

  return {
    storage,
    egress,
    companies,
    anyTriggered:
      storage.state === "triggered" || companies.state === "triggered",
    measuredAt,
  };
}
