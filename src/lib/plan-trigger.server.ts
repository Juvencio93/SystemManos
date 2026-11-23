import type { supabaseAdmin } from "@/integrations/supabase/client.server";

import {
  SWEEPED_BUCKETS,
  SWEEP_SKIPPED_BUCKET,
  listBucketObjects,
} from "./storage-orphan-sweep.server";

type AdminDb = typeof supabaseAdmin;

/** Orçamento da listagem dos buckets dentro da medição (a função no plano gratuito é 60 s). */
const BUCKET_LIST_BUDGET_MS = 25_000;

export interface MeasuredPlanTriggerUsage {
  /** Soma de TODOS os objetos de TODOS os buckets (o uso do plano conta o projeto inteiro, inclusive o bucket `logos`); null quando algum bucket não deu para listar. */
  totalStorageBytes: number | null;
  /** Empresas com status `ativa`. */
  activeCompanies: number;
}

/**
 * Mede o uso atual contra os gatilhos da Frente 9.
 *
 * Storage: soma o tamanho real de todos os objetos de todos os buckets
 * do projeto (reaproveita `listBucketObjects` da Frente 7) — nenhum
 * arquivo é baixado. Se QUALQUER bucket falhar, o total fica null: um
 * total parcial passaria falsa segurança.
 *
 * Empresas ativas: contagem no banco (`companies` com status `ativa`).
 *
 * Egress: sem fonte confiável no código — não é medido aqui (o item
 * fica manual no `buildPlanTriggerStatus`).
 */
export async function measurePlanTriggerUsage(
  db: AdminDb,
): Promise<MeasuredPlanTriggerUsage> {
  const deadline = Date.now() + BUCKET_LIST_BUDGET_MS;
  let totalStorageBytes: number | null = 0;
  for (const bucket of [...SWEEPED_BUCKETS, SWEEP_SKIPPED_BUCKET]) {
    try {
      const objects = await listBucketObjects(db, bucket, deadline);
      totalStorageBytes += objects.reduce((acc, o) => acc + o.size, 0);
    } catch (error) {
      console.warn(
        `[plan-trigger] Não foi possível listar o bucket ${bucket} para medir o uso:`,
        error,
      );
      totalStorageBytes = null;
      break;
    }
  }

  const { count, error } = await db
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("status", "ativa")
    .eq("blocked", false);
  if (error) throw new Error(error.message);

  return {
    totalStorageBytes,
    activeCompanies: count ?? 0,
  };
}
