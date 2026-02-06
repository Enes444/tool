# Backup & Restore (Automated + Tested)

## 1) Automatic backup (required P0)

### Windows Task Scheduler (every night 02:15)
Command:
`powershell.exe -ExecutionPolicy Bypass -File C:\path\to\project\scripts\backup_auto.ps1 -ProjectRoot C:\path\to\project -BackupDir C:\path\to\project\backups -KeepDays 14`

### Linux cron (every night 02:15)
`15 2 * * * cd /opt/sponsor_ops && KEEP_DAYS=14 ./scripts/backup_auto.sh . backups >> backups/backup.log 2>&1`

Backups produced:
- `backups/sponsorops_db_YYYYMMDD_HHMMSS.sqlite3`
- `backups/uploads_YYYYMMDD_HHMMSS.zip|tgz`

## 2) Restore test (required P0)

Run after first backup and at least weekly:
`powershell -ExecutionPolicy Bypass -File .\scripts\restore_test.ps1 -ProjectRoot . -BackupDir backups`

The script validates DB integrity and prints table list.  
Record result in `docs/RESTORE_TEST_LOG.md`.

## 3) Full restore procedure (real incident)

1. Stop stack: `docker compose down`
2. Copy backup DB file to volume container path (`/data/sponsor_ops.db`) via temp container or `docker cp`.
3. Restore uploads from archive to `backend/uploads`.
4. Start stack: `docker compose up -d`
5. Validate: `GET /healthz`, login, list pages.

RPO target (starter): 24h  
RTO target (starter): 2h