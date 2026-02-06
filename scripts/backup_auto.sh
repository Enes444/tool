#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="${1:-.}"
BACKUP_DIR="${2:-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$PROJECT_ROOT"
mkdir -p "$BACKUP_DIR"
ts=$(date +%Y%m%d_%H%M%S)

db_out="$BACKUP_DIR/sponsorops_db_${ts}.sqlite3"
uploads_out="$BACKUP_DIR/uploads_${ts}.tgz"

echo "Creating SQLite backup -> $db_out"
docker compose exec -T api sh -lc "sqlite3 /data/sponsor_ops.db '.backup /tmp/backup.sqlite3'"
docker cp "$(docker compose ps -q api):/tmp/backup.sqlite3" "$db_out"
docker compose exec -T api sh -lc "rm -f /tmp/backup.sqlite3"

echo "Creating uploads backup -> $uploads_out"
if [ -d backend/uploads ]; then
  tar -czf "$uploads_out" -C backend uploads
else
  echo "No backend/uploads found, skipping uploads tar."
fi

echo "Pruning backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete

echo "Done."
ls -lh "$BACKUP_DIR" | tail -n +1