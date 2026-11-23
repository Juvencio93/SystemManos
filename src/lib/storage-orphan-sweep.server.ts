import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractStorageObjectPath } from "./company-delete";

type AdminDb = typeof supabaseAdmin;

/**
 * Varredura periódica de órfãos do Storage (Frente 7 da correção de
 * storage). Um job semanal lista os objetos dos buckets e apaga os que
 * não têm mais referência em nenhuma tabela do banco — a rede de
 * segurança para os casos que as Frentes 1–6 não pegam (upload sem
 * salvar, finalize recusado, envio de chat falho, exclusão que falhou
 * no meio, avatar de login apagado pela exclusão de filial).
 *
 * REGRAS DE SEGURANÇA (não relaxar sem revisar):
 *  1. DRY-RUN POR PADRÃO. A varredura só apaga quando a variável
 *     `STORAGE_SWEEP_LIVE` vale exatamente `"true"`. Sem ela, o job
 *     só lista e registra — é assim que nasce, e fica assim por 2–3
 *     semanas até a lista de órfãos ser conferida.
 *  2. SÓ APAGA OBJETO VELHO. Objeto criado há menos de
 *     `ORPHAN_MIN_AGE_DAYS` dias nunca é apagado: um upload feito há
 *     minutos pode ainda estar esperando o save (campanha, logo,
 *     anexo de chat). A idade é lida do `created_at` do objeto.
 *  3. TETO DE EXCLUSÃO. No máximo `MAX_DELETE_PER_RUN` objetos por
 *     execução. Se houver mais órfãos, os restantes ficam para a
 *     próxima semana — um erro na coleta de referências nunca esvazia
 *     um bucket de uma vez.
 *  4. REFERÊNCIAS PRIMEIRO. Se a coleta de referências falhar, NADA é
 *     apagado (nem em modo live): sem a lista completa não dá para
 *     saber o que é órfão. Se a listagem de um bucket falhar no meio,
 *     aquele bucket é pulado (nunca apagado parcialmente).
 *  5. BUCKET `logos` SÓ COM CHAVE EXPLÍCITA (Frente 10). Origem
 *     identificada nas migrations: o `logos` era o bucket de logos
 *     ORIGINAL (ago/2026 — pastas `plataforma/`, `empresas/<uuid>/`,
 *     `filiais/<uuid>/`, ver `20260811055443_*` e a seção "legacy
 *     logos bucket" de `20260904012314_*`); em 27/08/2026 a logo da
 *     plataforma mudou para o bucket `brand-assets` (pasta
 *     `logos/<uid>/` — pasta, não bucket) e as logos de
 *     empresa/filial para o `campaign-assets`
 *     (`users/<uid>/company-logos/` e `branch-logos/`). A criação do
 *     bucket em si NÃO está em nenhuma migration (foi feita no
 *     Dashboard) e nenhum código atual o referencia como bucket.
 *     Por isso ele NÃO tem nenhuma referência coletada: com a chave
 *     `STORAGE_SWEEP_INCLUDE_LOGOS=true`, TODOS os objetos dele
 *     viram órfãos. A chave nasce DESLIGADA e só é ligada depois de
 *     identificar os arquivos — ver
 *     `docs/operacao/storage-bucket-logos.md`. Sem a chave, a
 *     varredura só conta quantos arquivos e bytes há nele.
 *  6. TUDO REGISTRADO. Cada execução grava uma linha em
 *     `storage_orphan_sweep_runs` (por bucket, com totais) — a prova
 *     de que o job rodou e do que ele fez. Falha de gravação do
 *     registro nunca derruba a varredura, mas é logada como erro.
 *
 * Fontes de referência (todas conferidas no código atual, Frentes 1–6):
 *  - campaign-assets: `companies.logo_url`, `branches.logo_url`,
 *    `campaigns.logo_url` + `campaigns.banner_urls` (vídeo .mp4 leva
 *    também a capa .jpg derivada), `campaign_sponsors.logo_path` /
 *    `banner_path`, `banner_describe_attachments.storage_path`,
 *    `image_generations.image_url` (hoje sempre null, defensivo).
 *  - brand-assets: `platform_settings.logo_url`,
 *    `platform_settings.logo_url_relatorios`.
 *  - chat-avatars: `profiles.chat_avatar_url` — avatar de usuário
 *    cujo perfil sumiu (login apagado pela exclusão de filial, Frente
 *    3) vira órfão aqui e é recolhido.
 *  - chat_attachments: `chat_attachments.file_path`.
 *
 * Escopo (Frente 10): a coleta de referências é GLOBAL — todas as
 * empresas, sem filtro por empresa. A primeira execução em dry-run
 * já é a "rodada única em todas as empresas" da Frente 10; não
 * existe segundo job.
 */

export const SWEEPED_BUCKETS = [
  "campaign-assets",
  "brand-assets",
  "chat-avatars",
  "chat_attachments",
] as const;

/** Bucket listado só para contagem — nunca varrido nem apagado. */
export const SWEEP_SKIPPED_BUCKET = "logos";

/** Só apaga objeto criado há mais de 7 dias (upload em andamento). */
export const ORPHAN_MIN_AGE_DAYS = 7;

/** Teto de exclusão por execução (rede de segurança). */
export const MAX_DELETE_PER_RUN = 500;

/** Orçamento de tempo da execução (o limite da função no plano gratuito é 60 s — o orçamento interno fica abaixo dele para a varredura parar limpa e registrar `partial` antes de o Vercel encerrar a função). */
export const SWEEP_TIME_BUDGET_MS = 50_000;

/** Tamanho do lote de exclusão no Storage. */
const DELETE_BATCH_SIZE = 100;

const LIST_PAGE_SIZE = 100;

export type SweepMode = "dry-run" | "live";

export type SweepBucketSummary = {
  bucket: string;
  totalObjects: number;
  totalBytes: number;
  orphanFiles: number;
  orphanBytes: number;
  deletedFiles: number;
  deletedBytes: number;
  skippedYoungFiles: number;
  skipped?: string;
  error?: string;
};

export type StorageOrphanSweepSummary = {
  mode: SweepMode;
  status: "completed" | "partial" | "failed";
  startedAt: string;
  finishedAt: string;
  buckets: SweepBucketSummary[];
  totalObjects: number;
  totalBytes: number;
  orphanFiles: number;
  orphanBytes: number;
  deletedFiles: number;
  deletedBytes: number;
  skippedYoungFiles: number;
  error?: string;
};

/** Modo da varredura: live só com `STORAGE_SWEEP_LIVE=true`. */
export function sweepMode(): SweepMode {
  return process.env["STORAGE_SWEEP_LIVE"] === "true" ? "live" : "dry-run";
}

/**
 * Inclui o bucket `logos` na varredura (Frente 10). DESLIGADO por
 * padrão: nenhum código referencia o bucket `logos` e ele não tem
 * nenhuma referência coletada — com a chave ligada, TODOS os objetos
 * dele viram órfãos (e são apagados em modo live, com as mesmas
 * travas: 7 dias, teto de 500). Só ligar depois de identificar os
 * arquivos com as queries de `docs/operacao/storage-bucket-logos.md`
 * e confirmar que nenhum deles está referenciado no banco.
 */
export function sweepIncludesLogos(): boolean {
  return process.env["STORAGE_SWEEP_INCLUDE_LOGOS"] === "true";
}

class SweepDeadlineError extends Error {
  constructor() {
    super("Tempo da varredura esgotado.");
  }
}

/** Objeto listado no Storage (reaproveitado pela medição de quota da Frente 8). */
export type StoredObject = {
  path: string;
  size: number;
  createdAt: string | null;
};

/** Lê todas as linhas de uma tabela em páginas de 1000. */
async function fetchAllRows(
  db: AdminDb,
  table: string,
  columns: string,
): Promise<Array<Record<string, unknown>>> {
  const pageSize = 1000;
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await (db as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          range: (
            from: number,
            to: number,
          ) => Promise<{
            data: Array<Record<string, unknown>> | null;
            error: { message: string } | null;
          }>;
        };
      };
    })
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Coleta TODAS as referências de arquivos do banco, por bucket. Devolve
 * um mapa bucket → conjunto de caminhos. Lança erro se qualquer fonte
 * falhar — nesse caso a varredura aborta antes de apagar qualquer coisa.
 */
async function collectReferences(
  db: AdminDb,
): Promise<Map<string, Set<string>>> {
  const refs = new Map<string, Set<string>>();
  const add = (bucket: string, value: string | null | undefined) => {
    const path = extractStorageObjectPath(bucket, value);
    if (!path) return;
    let set = refs.get(bucket);
    if (!set) {
      set = new Set<string>();
      refs.set(bucket, set);
    }
    set.add(path);
  };

  // campaign-assets — logos de empresa e filial (URL assinada).
  for (const row of await fetchAllRows(db, "companies", "logo_url")) {
    add("campaign-assets", asString(row["logo_url"]));
  }
  for (const row of await fetchAllRows(db, "branches", "logo_url")) {
    add("campaign-assets", asString(row["logo_url"]));
  }
  // campaign-assets — campanhas: logo + banners. Vídeo .mp4 leva também
  // a capa .jpg derivada (mesma regra das Frentes 2–4).
  for (const row of await fetchAllRows(db, "campaigns", "logo_url, banner_urls")) {
    add("campaign-assets", asString(row["logo_url"]));
    const banners = row["banner_urls"];
    if (Array.isArray(banners)) {
      for (const banner of banners) {
        const path = extractStorageObjectPath("campaign-assets", asString(banner));
        if (!path) continue;
        add("campaign-assets", path);
        const clean = path.split(/[?#]/)[0] ?? path;
        if (/\.mp4$/i.test(clean)) {
          add("campaign-assets", clean.replace(/\.mp4$/i, ".jpg"));
        }
      }
    }
  }
  // campaign-assets — patrocinadores.
  for (const row of await fetchAllRows(
    db,
    "campaign_sponsors",
    "logo_path, banner_path",
  )) {
    add("campaign-assets", asString(row["logo_path"]));
    add("campaign-assets", asString(row["banner_path"]));
  }
  // campaign-assets — anexos do banner-describe.
  for (const row of await fetchAllRows(
    db,
    "banner_describe_attachments",
    "storage_path",
  )) {
    add("campaign-assets", asString(row["storage_path"]));
  }
  // campaign-assets — gerações de imagem (hoje sempre null; defensivo).
  for (const row of await fetchAllRows(db, "image_generations", "image_url")) {
    add("campaign-assets", asString(row["image_url"]));
  }
  // brand-assets — logos da plataforma.
  for (const row of await fetchAllRows(
    db,
    "platform_settings",
    "logo_url, logo_url_relatorios",
  )) {
    add("brand-assets", asString(row["logo_url"]));
    add("brand-assets", asString(row["logo_url_relatorios"]));
  }
  // chat-avatars — avatar de todo perfil que existe. Avatar de usuário
  // cujo perfil sumiu (login apagado pela exclusão de filial) não está
  // mais aqui — vira órfão e é recolhido pela varredura.
  for (const row of await fetchAllRows(db, "profiles", "chat_avatar_url")) {
    add("chat-avatars", asString(row["chat_avatar_url"]));
  }
  // chat_attachments — caminho cru do arquivo.
  for (const row of await fetchAllRows(db, "chat_attachments", "file_path")) {
    const path = asString(row["file_path"]);
    if (path) {
      let set = refs.get("chat_attachments");
      if (!set) {
        set = new Set<string>();
        refs.set("chat_attachments", set);
      }
      set.add(path);
    }
  }
  return refs;
}

/** Lista TODOS os objetos de um bucket, andando a árvore por prefixo (reaproveitado pela medição de quota da Frente 8). */
export async function listBucketObjects(
  db: AdminDb,
  bucket: string,
  deadline: number,
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  const walk = async (prefix: string): Promise<void> => {
    let offset = 0;
    for (;;) {
      if (Date.now() > deadline) throw new SweepDeadlineError();
      const { data, error } = await db.storage
        .from(bucket)
        .list(prefix, {
          limit: LIST_PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) throw new Error(error.message);
      const entries = data ?? [];
      for (const entry of entries) {
        // Pasta tem metadata nulo — desce nela. Arquivo tem metadata.
        const metadata = (
          entry as unknown as {
            metadata?: { size?: unknown } | null;
          }
        ).metadata;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (metadata == null) {
          await walk(path);
          continue;
        }
        const size =
          typeof metadata.size === "number" ? metadata.size : 0;
        objects.push({
          path,
          size,
          createdAt:
            typeof entry.created_at === "string" ? entry.created_at : null,
        });
      }
      if (entries.length < LIST_PAGE_SIZE) break;
      offset += LIST_PAGE_SIZE;
    }
  };
  await walk("");
  return objects;
}

async function recordRun(
  db: AdminDb,
  summary: StorageOrphanSweepSummary,
): Promise<void> {
  try {
    const { error } = await (db as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{
          error: { message: string } | null;
        }>;
      };
    })
      .from("storage_orphan_sweep_runs")
      .insert({
        started_at: summary.startedAt,
        finished_at: summary.finishedAt,
        mode: summary.mode,
        status: summary.status,
        buckets: summary.buckets,
        total_objects: summary.totalObjects,
        total_bytes: summary.totalBytes,
        orphan_files: summary.orphanFiles,
        orphan_bytes: summary.orphanBytes,
        deleted_files: summary.deletedFiles,
        deleted_bytes: summary.deletedBytes,
        skipped_young_files: summary.skippedYoungFiles,
        error: summary.error ?? null,
      });
    if (error) {
      console.error(
        "[storage-orphan-sweep] Não foi possível registrar a execução:",
        error.message,
      );
    }
  } catch (error) {
    console.error(
      "[storage-orphan-sweep] Não foi possível registrar a execução:",
      error,
    );
  }
}

function emptySummary(
  mode: SweepMode,
  startedAt: string,
): StorageOrphanSweepSummary {
  return {
    mode,
    status: "completed",
    startedAt,
    finishedAt: startedAt,
    buckets: [],
    totalObjects: 0,
    totalBytes: 0,
    orphanFiles: 0,
    orphanBytes: 0,
    deletedFiles: 0,
    deletedBytes: 0,
    skippedYoungFiles: 0,
  };
}

/**
 * Executa uma varredura completa. Em dry-run (padrão) só lista e
 * registra — nada é apagado. Em live apaga os órfãos velhos, até o
 * teto por execução. Nunca deixa uma falha sem registro: erro na
 * coleta de referências aborta tudo e vira execução `failed`; erro
 * num bucket pula só aquele bucket e a execução fica `partial`.
 */
export async function runStorageOrphanSweep(
  db: AdminDb,
): Promise<StorageOrphanSweepSummary> {
  const mode = sweepMode();
  const includeLogos = sweepIncludesLogos();
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + SWEEP_TIME_BUDGET_MS;
  const summary = emptySummary(mode, startedAt);
  const finish = () => {
    summary.finishedAt = new Date().toISOString();
    return summary;
  };

  // Fase 1 — referências. Qualquer falha aqui aborta TUDO: sem a lista
  // completa não dá para saber o que é órfão.
  let references: Map<string, Set<string>>;
  try {
    references = await collectReferences(db);
  } catch (error) {
    summary.status = "failed";
    summary.error =
      error instanceof Error
        ? `Falha ao coletar as referências do banco: ${error.message}`
        : "Falha ao coletar as referências do banco.";
    console.error("[storage-orphan-sweep]", summary.error);
    await recordRun(db, finish());
    throw new Error(summary.error);
  }

  const minAgeMs = ORPHAN_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let deletedSoFar = 0;

  // Fase 2 — um bucket por vez (o `logos` só é contado, salvo com a
  // chave STORAGE_SWEEP_INCLUDE_LOGOS=true — ver regra 5 no topo).
  const bucketsToSweep: string[] = [
    ...SWEEPED_BUCKETS,
    SWEEP_SKIPPED_BUCKET,
  ];
  for (const bucket of bucketsToSweep) {
    const bucketSummary: SweepBucketSummary = {
      bucket,
      totalObjects: 0,
      totalBytes: 0,
      orphanFiles: 0,
      orphanBytes: 0,
      deletedFiles: 0,
      deletedBytes: 0,
      skippedYoungFiles: 0,
    };
    summary.buckets.push(bucketSummary);
    try {
      const objects = await listBucketObjects(db, bucket, deadline);
      bucketSummary.totalObjects = objects.length;
      bucketSummary.totalBytes = objects.reduce((acc, o) => acc + o.size, 0);
      summary.totalObjects += bucketSummary.totalObjects;
      summary.totalBytes += bucketSummary.totalBytes;

      if (bucket === SWEEP_SKIPPED_BUCKET && !includeLogos) {
        bucketSummary.skipped =
          "Origem legada (Frente 10) — só é varrido com STORAGE_SWEEP_INCLUDE_LOGOS=true, depois de identificar os arquivos.";
        continue;
      }

      const referenced = references.get(bucket) ?? new Set<string>();
      const orphans = objects.filter((o) => !referenced.has(o.path));
      bucketSummary.orphanFiles = orphans.length;
      bucketSummary.orphanBytes = orphans.reduce((acc, o) => acc + o.size, 0);
      summary.orphanFiles += bucketSummary.orphanFiles;
      summary.orphanBytes += bucketSummary.orphanBytes;

      // Só os órfãos velhos podem ser apagados; os novos ficam para a
      // próxima semana (podem estar esperando o save).
      const eligible: StoredObject[] = [];
      for (const orphan of orphans) {
        const age = orphan.createdAt
          ? now - new Date(orphan.createdAt).getTime()
          : Number.POSITIVE_INFINITY;
        if (age >= minAgeMs) eligible.push(orphan);
        else bucketSummary.skippedYoungFiles += 1;
      }
      summary.skippedYoungFiles += bucketSummary.skippedYoungFiles;

      if (mode === "live" && eligible.length > 0) {
        const remainingCap = MAX_DELETE_PER_RUN - deletedSoFar;
        const toDelete = eligible.slice(0, Math.max(0, remainingCap));
        for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
          if (Date.now() > deadline) throw new SweepDeadlineError();
          const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE);
          const { data: removed, error: removeError } = await db.storage
            .from(bucket)
            .remove(batch.map((o) => o.path));
          if (removeError) {
            bucketSummary.error = `Falha ao apagar objetos: ${removeError.message}`;
            summary.status = "partial";
            console.error(
              `[storage-orphan-sweep] ${bucket}:`,
              bucketSummary.error,
            );
            break;
          }
          const removedList = removed ?? [];
          const removedNames = new Set(
            removedList.map((r) => r.name),
          );
          let matched = 0;
          let matchedBytes = 0;
          for (const object of batch) {
            if (removedNames.has(object.path)) {
              matched += 1;
              matchedBytes += object.size;
            }
          }
          if (matched === 0 && removedList.length > 0) {
            // A API devolveu os removidos sem o caminho completo: conta
            // por quantidade, como a exclusão de empresa (Frente 2).
            matched = removedList.length;
            matchedBytes = batch
              .slice(0, matched)
              .reduce((acc, o) => acc + o.size, 0);
          }
          bucketSummary.deletedFiles += matched;
          bucketSummary.deletedBytes += matchedBytes;
          deletedSoFar += matched;
        }
        if (eligible.length > toDelete.length) {
          summary.status = "partial";
          console.warn(
            `[storage-orphan-sweep] ${bucket}: ${eligible.length - toDelete.length} órfão(s) ficaram para a próxima execução (teto de ${MAX_DELETE_PER_RUN} por execução).`,
          );
        }
        summary.deletedFiles += bucketSummary.deletedFiles;
        summary.deletedBytes += bucketSummary.deletedBytes;
      }
    } catch (error) {
      if (error instanceof SweepDeadlineError) {
        summary.status = "partial";
        bucketSummary.error =
          "Tempo da varredura esgotado — bucket pulado, volta na próxima execução.";
        console.warn(`[storage-orphan-sweep] ${bucket}: tempo esgotado.`);
      } else {
        summary.status = "partial";
        bucketSummary.error =
          error instanceof Error
            ? error.message
            : "Falha ao listar o bucket.";
        console.error(
          `[storage-orphan-sweep] ${bucket}:`,
          bucketSummary.error,
        );
      }
    }
  }

  await recordRun(db, finish());
  return summary;
}
