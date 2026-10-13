import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.515.0";

const SOURCE_BUCKETS = [
  "logos",
  "campaign-assets",
  "brand-assets",
  "chat_attachments",
  "chat-avatars",
] as const;
const BACKUP_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const RETENTION_COUNT = 8;
const PAGE_SIZE = 1000;
const COPY_CONCURRENCY = 4;
const INDEX_KEY = "storage-backups/index.json";
const LAST_RUN_KEY = "storage-backups/last-run.json";
const TIME_ZONE = "America/Sao_Paulo";

type SourceFile = {
  bucket: string;
  path: string;
};

type ManifestFile = SourceFile & {
  destinationKey: string;
  size: number;
  contentType: string;
  sha256: string;
};

type BackupRecord = {
  id: string;
  prefix: string;
  createdAt: string;
  localDate: string;
  fileCount: number;
  totalBytes: number;
};

type BackupIndex = {
  version: 1;
  lastBackupAt: string | null;
  backups: BackupRecord[];
};

type BackupManifest = BackupRecord & {
  version: 1;
  timeZone: typeof TIME_ZONE;
  buckets: string[];
  bucketConfigs: Array<{
    name: string;
    public: boolean;
    fileSizeLimit: number | null;
    allowedMimeTypes: string[] | null;
  }>;
  files: ManifestFile[];
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function localDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function readJson<T>(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<T | null> {
  try {
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await result.Body?.transformToString();
    return body ? (JSON.parse(body) as T) : null;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (
      name === "NoSuchKey" ||
      name === "NotFound" ||
      name === "NoSuchBucket"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeJson(
  client: S3Client,
  bucket: string,
  key: string,
  value: unknown,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value, null, 2),
      ContentType: "application/json",
    }),
  );
}

async function listSourceFiles(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  folder = "",
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Unable to list source bucket ${bucket}`);
    }

    const entries = data ?? [];
    for (const entry of entries) {
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.id) {
        files.push({ bucket, path });
      } else {
        files.push(...(await listSourceFiles(supabase, bucket, path)));
      }
    }

    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return files;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

async function deletePrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => Boolean(key))
      .map((Key) => ({ Key }));

    if (objects.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      deleted += objects.length;
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deleted;
}

Deno.serve(async (request: Request) => {
  const startedAt = new Date();

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET")?.trim();
  if (!cronSecret) {
    console.error("[R2 backup] CRON_SECRET is not configured");
    return jsonResponse({ error: "Backup service is not configured" }, 503);
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const r2AccountId = requiredEnv("R2_ACCOUNT_ID");
    const r2Endpoint = requiredEnv("R2_ENDPOINT").replace(/\/$/, "");
    const r2AccessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
    const r2Bucket = requiredEnv("R2_BUCKET_NAME");

    const endpointHost = new URL(r2Endpoint).hostname;
    if (!endpointHost.startsWith(`${r2AccountId}.r2.`)) {
      throw new Error("R2 endpoint does not match R2 account");
    }

    let force = false;
    try {
      const body = await request.json();
      force =
        typeof body === "object" &&
        body !== null &&
        "force" in body &&
        body.force === true;
    } catch {
      // Empty body is valid for scheduled runs.
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const r2 = new S3Client({
      region: "auto",
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    const index =
      (await readJson<BackupIndex>(r2, r2Bucket, INDEX_KEY)) ?? {
        version: 1,
        lastBackupAt: null,
        backups: [],
      };

    if (!force && index.lastBackupAt) {
      const elapsed = startedAt.getTime() - Date.parse(index.lastBackupAt);
      if (Number.isFinite(elapsed) && elapsed < BACKUP_INTERVAL_MS) {
        const result = {
          status: "ignored",
          reason: "backup_interval_not_reached",
          checkedAt: startedAt.toISOString(),
          timeZone: TIME_ZONE,
          daysSinceLastBackup: Number(
            (elapsed / (24 * 60 * 60 * 1000)).toFixed(2),
          ),
        };
        await writeJson(r2, r2Bucket, LAST_RUN_KEY, result);
        console.log("[R2 backup] ignored: interval not reached");
        return jsonResponse(result);
      }
    }

    const date = localDate(startedAt);
    const prefix = `storage-backups/${date}/`;

    const nestedFiles = await Promise.all(
      SOURCE_BUCKETS.map((bucket) => listSourceFiles(supabase, bucket)),
    );
    const sourceFiles = nestedFiles.flat();

    const copiedFiles = await mapWithConcurrency(
      sourceFiles,
      COPY_CONCURRENCY,
      async (file): Promise<ManifestFile> => {
        const { data, error } = await supabase.storage
          .from(file.bucket)
          .download(file.path);

        if (error || !data) {
          throw new Error(`Unable to download an object from ${file.bucket}`);
        }

        const bytes = new Uint8Array(await data.arrayBuffer());
        const destinationKey = `${prefix}${file.bucket}/${file.path}`;
        const contentType = data.type || "application/octet-stream";

        await r2.send(
          new PutObjectCommand({
            Bucket: r2Bucket,
            Key: destinationKey,
            Body: bytes,
            ContentType: contentType,
          }),
        );
        const uploaded = await r2.send(
          new HeadObjectCommand({ Bucket: r2Bucket, Key: destinationKey }),
        );
        if (uploaded.ContentLength !== bytes.byteLength) {
          throw new Error(`Uploaded object size mismatch for ${file.bucket}`);
        }

        return {
          ...file,
          destinationKey,
          size: bytes.byteLength,
          contentType,
          sha256: await sha256Hex(bytes),
        };
      },
    );

    const totalBytes = copiedFiles.reduce((sum, file) => sum + file.size, 0);
    const record: BackupRecord = {
      id: date,
      prefix,
      createdAt: startedAt.toISOString(),
      localDate: date,
      fileCount: copiedFiles.length,
      totalBytes,
    };

    const { data: sourceBuckets, error: bucketsError } = await supabase.storage
      .listBuckets();
    if (bucketsError) throw new Error("Unable to read source bucket configuration");
    const bucketConfigs = SOURCE_BUCKETS.map((name) => {
      const config = (sourceBuckets ?? []).find((bucket) => bucket.name === name);
      if (!config) throw new Error(`Required storage bucket is missing: ${name}`);
      return {
        name,
        public: config.public,
        fileSizeLimit: config.file_size_limit ?? null,
        allowedMimeTypes: config.allowed_mime_types ?? null,
      };
    });

    const manifest: BackupManifest = {
      version: 1,
      ...record,
      timeZone: TIME_ZONE,
      buckets: [...SOURCE_BUCKETS],
      bucketConfigs,
      files: copiedFiles,
    };

    await writeJson(r2, r2Bucket, `${prefix}manifest.json`, manifest);

    const nextBackups = [
      ...index.backups.filter((backup) => backup.id !== record.id),
      record,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const expired = nextBackups.slice(
      0,
      Math.max(0, nextBackups.length - RETENTION_COUNT),
    );
    let deletedObjects = 0;

    for (const backup of expired) {
      deletedObjects += await deletePrefix(r2, r2Bucket, backup.prefix);
    }

    const retainedBackups = nextBackups.slice(-RETENTION_COUNT);
    const nextIndex: BackupIndex = {
      version: 1,
      lastBackupAt: startedAt.toISOString(),
      backups: retainedBackups,
    };

    await writeJson(r2, r2Bucket, INDEX_KEY, nextIndex);

    const result = {
      status: "success",
      backup: record,
      retainedBackups: retainedBackups.length,
      deletedObjects,
      completedAt: new Date().toISOString(),
      timeZone: TIME_ZONE,
    };
    await writeJson(r2, r2Bucket, LAST_RUN_KEY, result);

    console.log("[R2 backup] completed", {
      fileCount: record.fileCount,
      totalBytes: record.totalBytes,
      retainedBackups: retainedBackups.length,
      deletedObjects,
    });

    return jsonResponse(result);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    console.error("[R2 backup] failed", { errorType });
    return jsonResponse({ error: "Backup failed", errorType }, 500);
  }
});

