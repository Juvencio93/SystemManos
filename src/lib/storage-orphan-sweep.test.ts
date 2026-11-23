import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sweepServer = readFileSync(
  resolve(process.cwd(), "src/lib/storage-orphan-sweep.server.ts"),
  "utf8",
);
const sweepRoute = readFileSync(
  resolve(process.cwd(), "src/routes/api/public/storage-orphan-sweep.ts"),
  "utf8",
);
const sweepMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261123170000_storage_orphan_sweep_runs.sql",
  ),
  "utf8",
);
const vercelConfig = readFileSync(
  resolve(process.cwd(), "vercel.json"),
  "utf8",
);

/**
 * Trava as regras de segurança da varredura de órfãos (Frente 7).
 * Se alguém "simplificar" o dry-run, o teto de exclusão ou a idade
 * mínima, este teste quebra antes do deploy — é o cinto de segurança
 * da frente que apaga arquivos do Storage.
 */
describe("storage orphan sweep (Frente 7)", () => {
  it("protects the sweep route with Vercel's cron secret", () => {
    expect(sweepRoute).toContain('process.env["CRON_SECRET"]');
    expect(sweepRoute).toContain("Bearer ${cronSecret}");
    expect(sweepRoute).toContain("runStorageOrphanSweep");
  });

  it("keeps internal failures out of the sweep response", () => {
    expect(sweepRoute).not.toContain("error.message");
    expect(sweepRoute).not.toContain("JSON.stringify({ error: error");
  });

  it("is dry-run by default and only deletes with an explicit live flag", () => {
    expect(sweepServer).toContain('process.env["STORAGE_SWEEP_LIVE"] === "true"');
    expect(sweepServer).toContain('"dry-run"');
    expect(sweepServer).not.toContain('STORAGE_SWEEP_LIVE"] === "false"');
  });

  it("never deletes young objects or more than the per-run cap", () => {
    expect(sweepServer).toContain("ORPHAN_MIN_AGE_DAYS = 7");
    expect(sweepServer).toContain("MAX_DELETE_PER_RUN = 500");
    expect(sweepServer).toContain("skippedYoungFiles");
  });

  it("aborts before deleting anything when references cannot be collected", () => {
    expect(sweepServer).toContain("collectReferences");
    expect(sweepServer).toContain("Falha ao coletar as referências do banco");
  });

  it("only sweeps the logos bucket with the explicit opt-in flag (Frente 10)", () => {
    expect(sweepServer).toContain('SWEEP_SKIPPED_BUCKET = "logos"');
    // Sem a chave, o logos nunca entra na lista de buckets varridos.
    expect(sweepServer).toContain(`export const SWEEPED_BUCKETS = [
  "campaign-assets",
  "brand-assets",
  "chat-avatars",
  "chat_attachments",
] as const;`);
    // A chave é explícita e só vale com o valor exato "true".
    expect(sweepServer).toContain(
      'process.env["STORAGE_SWEEP_INCLUDE_LOGOS"] === "true"',
    );
    expect(sweepServer).toContain(
      "if (bucket === SWEEP_SKIPPED_BUCKET && !includeLogos)",
    );
  });

  it("covers every reference source enumerated in the storage review", () => {
    for (const source of [
      '"companies", "logo_url"',
      '"branches", "logo_url"',
      '"campaigns", "logo_url, banner_urls"',
      '"campaign_sponsors"',
      '"banner_describe_attachments"',
      '"image_generations", "image_url"',
      '"platform_settings"',
      '"profiles", "chat_avatar_url"',
      '"chat_attachments", "file_path"',
    ]) {
      expect(sweepServer).toContain(source);
    }
    // Vídeo .mp4 leva também a capa .jpg derivada (regra das Frentes 2–4).
    expect(sweepServer).toContain('.replace(/\\.mp4$/i, ".jpg")');
  });

  it("records every run in the sweep runs table", () => {
    expect(sweepMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.storage_orphan_sweep_runs",
    );
    expect(sweepMigration).toContain(
      "ALTER TABLE public.storage_orphan_sweep_runs ENABLE ROW LEVEL SECURITY",
    );
    expect(sweepServer).toContain("storage_orphan_sweep_runs");
  });

  it("schedules the sweep weekly on Sundays via Vercel cron", () => {
    expect(vercelConfig).toContain("/api/public/storage-orphan-sweep");
    expect(vercelConfig).toContain('"0 7 * * 0"');
  });
});
