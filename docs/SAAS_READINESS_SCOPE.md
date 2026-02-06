# SaaS Readiness Scope (What this ZIP completes)

## Completed in this package
- One-click local/prod-like startup with auto `.env` + JWT generation.
- Alembic migration wiring in container.
- Bootstrap admin + first customer seed.
- Health, prelive and P0 quick checks.
- Configurable host ports (`API_PORT`, `WEB_PORT`) to avoid conflicts.
- Improved PowerShell scripts (`-UseBasicParsing`) to avoid interactive warnings.

## Still external/non-ZIP responsibilities
- Production domain, DNS, SSL certificate, reverse proxy hardening.
- Legal: AVV/DPA, privacy policy, imprint, retention policy sign-off.
- Managed monitoring/alerts destinations (Slack/Pager/Email) in production infra.
- Real backup retention and offsite restore drills.
