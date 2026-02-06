#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
ts=$(date +%Y%m%d_%H%M%S)

echo "Creating backup backups/sponsorops_${ts}.tar.gz"
# Backup the named volume data + uploads bind mount (backend/uploads)
docker compose exec -T api sh -lc 'tar -czf /tmp/sponsorops_backup.tgz -C / data'
tarfile="backups/sponsorops_${ts}.tar.gz"
docker cp "$(docker compose ps -q api)":/tmp/sponsorops_backup.tgz "$tarfile"
docker compose exec -T api sh -lc 'rm -f /tmp/sponsorops_backup.tgz'

# Also backup uploads from host bind mount
tar -czf "backups/uploads_${ts}.tar.gz" -C backend uploads

echo "Done:"
ls -lh "$tarfile" "backups/uploads_${ts}.tar.gz"