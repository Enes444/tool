Write-Host "== Sponsor Ops Pre-Live Check =="

if (!(Test-Path .env)) {
  Write-Error ".env fehlt im Projektordner"
  exit 1
}

$envFile = Get-Content .env -Raw
if ($envFile -notmatch "SPONSOR_OPS_JWT_SECRET=") {
  Write-Error "SPONSOR_OPS_JWT_SECRET fehlt in .env"
  exit 1
}

Write-Host "[OK] .env vorhanden"

docker compose config *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose config fehlgeschlagen"
  exit 1
}
Write-Host "[OK] docker compose config"

Write-Host "Starte Container testweise..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit 1 }

Start-Sleep -Seconds 4

try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -UseBasicParsing -TimeoutSec 10
  if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
    Write-Host "[OK] API erreichbar"
  }
} catch {
  Write-Warning "API docs nicht erreichbar"
}

try {
  $w = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 10
  if ($w.StatusCode -eq 200) { Write-Host "[OK] Web erreichbar" }
} catch {
  Write-Warning "Web nicht erreichbar"
}

Write-Host "Logs (api):"
docker compose logs --no-color --tail=40 api
Write-Host "\nLogs (web):"
docker compose logs --no-color --tail=40 web

Write-Host "\nPre-Live Check abgeschlossen."