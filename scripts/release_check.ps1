param(
  [string]$ProjectRoot = "."
)
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host "1) Compose config validation..."
docker compose config | Out-Null

Write-Host "2) Build images..."
docker compose build

Write-Host "3) Start stack..."
docker compose up -d

Write-Host "4) Wait for health..."
Start-Sleep -Seconds 8
docker compose ps

Write-Host "5) Run monitoring check..."
.\scripts\monitor_check.ps1 -ProjectRoot .

Write-Host "6) Manual smoke checklist..."
.\scripts\smoke_test.ps1

Write-Host "Release check complete."