#!/usr/bin/env bash
set -Eeuo pipefail

: "${SUPABASE_DB_URL:?Configure SUPABASE_DB_URL in GitHub Actions secrets}"
: "${SUPABASE_PROJECT_REF:?Configure SUPABASE_PROJECT_REF in GitHub Actions variables}"
: "${BACKUP_AGE_RECIPIENT:?Configure BACKUP_AGE_RECIPIENT in GitHub Actions variables}"
: "${R2_ACCOUNT_ID:?Configure R2_ACCOUNT_ID in GitHub Actions secrets}"
: "${R2_ACCESS_KEY_ID:?Configure R2_ACCESS_KEY_ID in GitHub Actions secrets}"
: "${R2_SECRET_ACCESS_KEY:?Configure R2_SECRET_ACCESS_KEY in GitHub Actions secrets}"
: "${R2_BUCKET_NAME:?Configure R2_BUCKET_NAME in GitHub Actions variables}"

backup_date="$(TZ=America/Sao_Paulo date +%F)"
backup_id="${backup_date}-$(date -u +%H%M%S)"
backup_prefix="database-backups/${backup_date}/${backup_id}"
endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
workdir="$(mktemp -d)"
trap 'rm -rf -- "$workdir"' EXIT

supabase db dump --db-url "$SUPABASE_DB_URL" --file "$workdir/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" --file "$workdir/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --file "$workdir/data.sql" \
  --use-copy --data-only \
  -x storage.buckets_vectors \
  -x storage.vector_indexes

for dump_file in roles.sql schema.sql data.sql; do
  test -s "$workdir/$dump_file"
done

tar -C "$workdir" -czf "$workdir/database.tar.gz" roles.sql schema.sql data.sql
age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" \
  --output "$workdir/database.tar.gz.age" "$workdir/database.tar.gz"

artifact="$workdir/database.tar.gz.age"
artifact_size="$(wc -c < "$artifact" | tr -d '[:space:]')"
artifact_sha256="$(sha256sum "$artifact" | cut -d ' ' -f 1)"
manifest="$workdir/manifest.json"
printf '{"version":1,"projectRef":"%s","date":"%s","backupId":"%s","encryptedFile":"database.tar.gz.age","sizeBytes":%s,"sha256":"%s","encryption":"age"}\n' \
  "$SUPABASE_PROJECT_REF" "$backup_date" "$backup_id" "$artifact_size" "$artifact_sha256" > "$manifest"

aws --endpoint-url "$endpoint" s3 cp "$artifact" \
  "s3://${R2_BUCKET_NAME}/${backup_prefix}/database.tar.gz.age" --only-show-errors
aws --endpoint-url "$endpoint" s3 cp "$manifest" \
  "s3://${R2_BUCKET_NAME}/${backup_prefix}/manifest.json" --only-show-errors

remote_size="$(aws --endpoint-url "$endpoint" s3api head-object \
  --bucket "$R2_BUCKET_NAME" --key "${backup_prefix}/database.tar.gz.age" \
  --query ContentLength --output text)"
if [[ "$remote_size" != "$artifact_size" ]]; then
  echo "Remote backup size differs from local artifact" >&2
  exit 1
fi

aws --endpoint-url "$endpoint" s3 cp \
  "s3://${R2_BUCKET_NAME}/${backup_prefix}/database.tar.gz.age" \
  "$workdir/roundtrip.tar.gz.age" --only-show-errors
roundtrip_sha256="$(sha256sum "$workdir/roundtrip.tar.gz.age" | cut -d ' ' -f 1)"
if [[ "$roundtrip_sha256" != "$artifact_sha256" ]]; then
  echo "Remote backup checksum verification failed" >&2
  exit 1
fi

echo "Database backup verified: ${backup_prefix} (${artifact_size} bytes)"
