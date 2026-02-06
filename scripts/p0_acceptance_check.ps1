$ErrorActionPreference = 'Stop'
Write-Host 'P0 quick acceptance check...'
$health = Invoke-RestMethod -Uri 'http://localhost:8000/healthz' -Method GET
if (-not $health.ok) { throw 'Health check failed' }

$openapi = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8000/openapi.json' -Method GET
if ($openapi.StatusCode -ne 200) { throw 'OpenAPI not reachable' }

docker compose ps
Write-Host '✅ P0 quick checks passed (infra/app reachable).'
