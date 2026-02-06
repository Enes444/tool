# Staging / Release Check (P0)

Before every production deploy:

1. `docker compose config` (config valid)
2. `docker compose build`
3. `docker compose up -d`
4. Health check: `scripts/monitor_check.ps1`
5. Manual smoke: `scripts/smoke_test.ps1`
6. Create backup: `scripts/backup_auto.ps1`
7. Deploy production
8. Post-deploy health + smoke again

Quick command:
`powershell -ExecutionPolicy Bypass -File .\scripts\release_check.ps1 -ProjectRoot .`