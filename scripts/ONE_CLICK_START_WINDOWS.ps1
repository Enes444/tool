$ErrorActionPreference = 'Stop'

Write-Host '== Sponsor Ops One-Click Start ==' -ForegroundColor Cyan

if (!(Test-Path .env)) {
  Copy-Item .env.example .env
}

# Ensure JWT secret
$hasSecret = Select-String -Path .env -Pattern '^SPONSOR_OPS_JWT_SECRET=' -Quiet
$secretLine = ''
if ($hasSecret) { $secretLine = (Select-String -Path .env -Pattern '^SPONSOR_OPS_JWT_SECRET=').Line }
if ((-not $hasSecret) -or ($secretLine -match '^SPONSOR_OPS_JWT_SECRET=\s*$') -or ($secretLine -match 'CHANGE_ME_MIN_32_CHARS')) {
  $jwt = -join ((33..126) | Get-Random -Count 64 | ForEach-Object {[char]$_})
  (Get-Content .env) -replace '^SPONSOR_OPS_JWT_SECRET=.*$', "SPONSOR_OPS_JWT_SECRET=$jwt" | Set-Content .env
  if (-not (Select-String -Path .env -Pattern '^SPONSOR_OPS_JWT_SECRET=' -Quiet)) { Add-Content .env "SPONSOR_OPS_JWT_SECRET=$jwt" }
}

# Ensure bootstrap defaults exist
function Ensure-EnvLine([string]$key, [string]$value) {
  if (Select-String -Path .env -Pattern "^$key=" -Quiet) {
    (Get-Content .env) -replace "^$key=.*$", "$key=$value" | Set-Content .env
  } else {
    Add-Content .env "$key=$value"
  }
}

Ensure-EnvLine 'SPONSOR_OPS_BOOTSTRAP_EMAIL' 'admin@local.test'
Ensure-EnvLine 'SPONSOR_OPS_BOOTSTRAP_PASSWORD' 'ChangeMe_123456789!'
Ensure-EnvLine 'SPONSOR_OPS_FIRST_CUSTOMER_ORG' 'First Customer GmbH'
Ensure-EnvLine 'SPONSOR_OPS_FIRST_CUSTOMER_SPONSOR' 'ACME Sponsor'
Ensure-EnvLine 'SPONSOR_OPS_FIRST_CUSTOMER_DEAL' 'Launch Deal'

Write-Host 'Building and starting containers...' -ForegroundColor Yellow
docker compose up -d --build

Write-Host 'Running migrations...' -ForegroundColor Yellow
docker compose exec api alembic -c /app/alembic.ini upgrade head

Write-Host 'Bootstrapping admin + first customer...' -ForegroundColor Yellow
docker compose exec -e SPONSOR_OPS_BOOTSTRAP_EMAIL=admin@local.test -e SPONSOR_OPS_BOOTSTRAP_PASSWORD=ChangeMe_123456789! -e SPONSOR_OPS_FIRST_CUSTOMER_ORG="First Customer GmbH" -e SPONSOR_OPS_FIRST_CUSTOMER_SPONSOR="ACME Sponsor" -e SPONSOR_OPS_FIRST_CUSTOMER_DEAL="Launch Deal" api python -m app.bootstrap_first_customer

Write-Host 'Running P0 quick check...' -ForegroundColor Yellow
$health = Invoke-RestMethod -UseBasicParsing -Uri "http://localhost:$($env:API_PORT ?? '8000')/healthz" -Method GET
if (-not $health.ok) { throw 'Health check failed' }

Write-Host '✅ Done!' -ForegroundColor Green
Write-Host 'Frontend: http://localhost:$($env:WEB_PORT ?? '5173')'
Write-Host 'API:      http://localhost:$($env:API_PORT ?? '8000')/healthz'
Write-Host 'Login:    admin@local.test / ChangeMe_123456789!'
Write-Host 'IMPORTANT: Passwort direkt nach dem ersten Login ändern.' -ForegroundColor Magenta
