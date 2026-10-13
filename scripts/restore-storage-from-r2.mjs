import { createHash } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const [backupDate] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(backupDate ?? "")) {
  console.error("Usage: node scripts/restore-storage-from-r2.mjs YYYY-MM-DD");
  process.exit(2);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucketName = requiredEnv("R2_BUCKET_NAME");
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  },
});
const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const prefix = `storage-backups/${backupDate}/`;

const manifestResponse = await r2.send(
  new GetObjectCommand({ Bucket: bucketName, Key: `${prefix}manifest.json` }),
);
const manifestText = await manifestResponse.Body?.transformToString();
if (!manifestText) throw new Error(`No manifest found for ${backupDate}`);
const manifest = JSON.parse(manifestText);
if (manifest.date !== backupDate || !Array.isArray(manifest.files)) {
  throw new Error("Backup manifest is invalid");
}

const { data: targetBuckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw new Error(`Unable to inspect target buckets: ${listError.message}`);
const targetBucketNames = new Set(targetBuckets.map((bucket) => bucket.name));
for (const config of manifest.bucketConfigs ?? []) {
  if (targetBucketNames.has(config.name)) continue;
  const { error: createError } = await supabase.storage.createBucket(config.name, {
    public: config.public,
    fileSizeLimit: config.fileSizeLimit ?? undefined,
    allowedMimeTypes: config.allowedMimeTypes ?? undefined,
  });
  if (createError) {
    throw new Error(`Unable to create target bucket ${config.name}: ${createError.message}`);
  }
  targetBucketNames.add(config.name);
}

let restored = 0;
for (const file of manifest.files) {
  const response = await r2.send(
    new GetObjectCommand({ Bucket: bucketName, Key: file.destinationKey }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Missing R2 object: ${file.destinationKey}`);
  if (bytes.byteLength !== file.size) {
    throw new Error(`Size check failed for ${file.bucket}/${file.path}`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (file.sha256 && digest !== file.sha256) {
    throw new Error(`SHA-256 check failed for ${file.bucket}/${file.path}`);
  }

  const { error } = await supabase.storage.from(file.bucket).upload(
    file.path,
    bytes,
    {
      contentType: file.contentType || "application/octet-stream",
      upsert: true,
    },
  );
  if (error) {
    throw new Error(
      `Upload failed for ${file.bucket}/${file.path}: ${error.message}`,
    );
  }
  restored++;
}

console.log(`Restored and verified ${restored} Storage objects from ${backupDate}.`);
