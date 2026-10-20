#!/usr/bin/env bash
# Nightly Postgres dump -> private S3 bucket (30-day lifecycle expiry set on the bucket).
# Uses the EC2 instance role (write-only to s3://$BUCKET/db/). Run from cron.
set -euo pipefail

BUCKET="${BACKUP_BUCKET:-careeriz-backups-362403299471}"
REGION="${AWS_REGION:-ap-southeast-2}"
cd "$(dirname "$0")"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp /tmp/careeriz-db-XXXXXX.sql.gz)"
trap 'rm -f "$TMP"' EXIT

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip -9 > "$TMP"

# Refuse to upload an empty/truncated dump.
if [ "$(stat -c %s "$TMP")" -lt 1024 ]; then
  echo "backup too small, aborting" >&2
  exit 1
fi

aws s3 cp "$TMP" "s3://$BUCKET/db/careeriz-$STAMP.sql.gz" --region "$REGION" --only-show-errors
echo "$(date -u +%FT%TZ) uploaded careeriz-$STAMP.sql.gz ($(stat -c %s "$TMP") bytes)"
