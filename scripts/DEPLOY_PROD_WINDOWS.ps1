$ErrorActionPreference = 'Stop'
Write-Host '== Sponsor Ops PROD Deploy ==' -ForegroundColor Cyan

if (!(Test-Path .env.prod)) {
  Copy-Item .env.prod.example .env.prod
  Write-Host 'Created .env.prod from template. Bitte DOMAIN, LETSENCRYPT_EMAIL und JWT setzen!' -ForegroundColor Yellow
  exit 1
}

$cfg = Get-Content .env.prod -Raw
if ($cfg -match 'SPONSOR_OPS_JWT_SECRET=CHANGE_ME' -or $cfg -notmatch 'SPONSOR_OPS_JWT_SECRET=.+') {
  throw 'SPONSOR_OPS_JWT_SECRET in .env.prod setzen (>=32 Zeichen).'
}

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api alembic -c /app/alembic.ini upgrade head
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api python -m app.bootstrap_first_customer

Write-Host 'Done. Prüfe:' -ForegroundColor Green
Write-Host 'https://'+((Select-String -Path .env.prod -Pattern '^DOMAIN=').Line -replace '^DOMAIN=','')
