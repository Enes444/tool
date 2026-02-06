$ErrorActionPreference = 'Stop'
Write-Host '== Sponsor Ops Go-Live Assist ==' -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File .\scripts\ONE_CLICK_START_WINDOWS.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\p0_acceptance_check.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\prelive_check.ps1
Write-Host 'Go-live assist completed.' -ForegroundColor Green
