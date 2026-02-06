# Sponsor Ops – Final Ready (Pre-Live)

Dieses Paket ist auf **finale Produktstruktur** ausgerichtet:

- **Operations Workspace (intern):** Inbox, Deals/Sponsors, Deliverables, Tickets/Claims, Settings
- **Sponsor Portal (extern):** Deliverables, Messages, Claims

## Schnellstart (Windows/WSL2 + Docker)

1. `.env` erstellen:
   ```powershell
   copy .env.example .env
   ```
2. Secret generieren und in `.env` setzen:
   ```powershell
   python scripts/gen_secret.py
   ```
   Dann `SPONSOR_OPS_JWT_SECRET=...` in `.env` eintragen.
3. Starten:
   ```powershell
   docker compose up --build
   ```
4. Einmalig Admin bootstrappen:
   ```powershell
   docker compose run --rm `
     -e SPONSOR_OPS_BOOTSTRAP_EMAIL="admin@deinefirma.de" `
     -e SPONSOR_OPS_BOOTSTRAP_PASSWORD="EinSehrStarkesPasswort" `
     api python -m app.bootstrap_admin
   ```

## URLs
- Web: http://localhost:5173
- API Docs: http://localhost:8000/docs

## Pre-Live Abschluss

1. Preflight laufen lassen:
   ```powershell
   ./scripts/prelive_check.ps1
   ```
2. Smoke-Test (manuell):
   ```powershell
   ./scripts/smoke_test.ps1
   ```
3. Checklisten in `docs/` abhaken:
   - `docs/EXECUTION_BOARD_PRELIVE.md`
   - `docs/GO_LIVE_CHECKLIST.md`
   - `docs/CUSTOMER_ADMIN_SOP.md`
   - `docs/OPERATIONS_RUNBOOK.md`

## Hinweise
- Kein Hard Delete in UI: Standard ist Archive/Restore.
- Bei JWT Secret Änderung: Browser-Storage/Token löschen und neu einloggen.
- Domain/TLS/Monitoring sind **Live-Later** Punkte und in den Checklisten markiert.

## P0 Operational Readiness (implemented)

This project now includes pre-live P0 operational tooling:

- **Automated backups**
  - `scripts/backup_auto.ps1` (Windows)
  - `scripts/backup_auto.sh` (Linux)
- **Restore test**
  - `scripts/restore_test.ps1`
  - evidence log: `docs/RESTORE_TEST_LOG.md`
- **Baseline monitoring/alerts**
  - `scripts/monitor_check.ps1` (uptime + container down + API 5xx)
  - guide: `docs/MONITORING_ALERTS.md`
- **Staging/release checks**
  - `scripts/release_check.ps1`
  - process: `docs/STAGING_RELEASE_CHECK.md`
- **Backup/restore runbook**
  - `docs/BACKUP_AND_RESTORE.md`

## Production readiness additions (2026-02-06)
- Alembic scaffolding added under `backend/alembic` (run migrations before startup).
- Optional Sentry integration via `SENTRY_DSN`.
- Structured JSON logging (`python-json-logger`).
- Basic backend CI workflow and health test.
- `SPONSOR_OPS_ENABLE_CREATE_ALL` env var (set `0` in prod once migrations are active).


## Windows One-Click Start (empfohlen)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ONE_CLICK_START_WINDOWS.ps1
```

Dieses Skript erledigt automatisch:
1. `.env` erstellen und JWT Secret setzen
2. `docker compose up -d --build`
3. Alembic Migrationen
4. Admin-Bootstrap + ersten Kundentenant/Testdaten
5. P0 Quick Acceptance Check

## Production deployment (HTTPS + domain)

1. Copy `.env.prod.example` to `.env.prod` and fill:
   - `DOMAIN`
   - `LETSENCRYPT_EMAIL`
   - `SPONSOR_OPS_JWT_SECRET` (>=32 chars)

2. Run:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\DEPLOY_PROD_WINDOWS.ps1
```

This starts `api`, `web`, and `caddy` with automatic HTTPS.
