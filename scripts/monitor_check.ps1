param(
  [string]$ProjectRoot = ".",
  [string]$ApiUrl = "http://localhost:8000/healthz",
  [string]$WebUrl = "http://localhost:5173/",
  [int]$LookbackMinutes = 5,
  [string]$AlertWebhook = ""
)
$ErrorActionPreference = "Continue"
Set-Location $ProjectRoot

$issues = @()

# container status
$ps = docker compose ps --format json | ConvertFrom-Json
foreach ($c in $ps) {
  if ($c.State -ne "running") { $issues += "Container not running: $($c.Service) state=$($c.State)" }
}

# health endpoints
try { $api = Invoke-WebRequest -Uri $ApiUrl -UseBasicParsing -TimeoutSec 8; if ($api.StatusCode -ne 200) { $issues += "API health returned $($api.StatusCode)" } } catch { $issues += "API health failed: $($_.Exception.Message)" }
try { $web = Invoke-WebRequest -Uri $WebUrl -UseBasicParsing -TimeoutSec 8; if ($web.StatusCode -ne 200) { $issues += "Web returned $($web.StatusCode)" } } catch { $issues += "Web check failed: $($_.Exception.Message)" }

# 5xx count in API logs
$since = (Get-Date).AddMinutes(-$LookbackMinutes).ToString("s")
$logs = docker compose logs api --since "${LookbackMinutes}m" 2>$null
$five = ($logs | Select-String -Pattern " 5\d\d ").Count
if ($five -gt 0) { $issues += "API returned $five 5xx responses in last $LookbackMinutes minutes" }

if ($issues.Count -eq 0) {
  Write-Host "OK - monitoring checks passed."
  exit 0
}

$msg = "ALERT SponsorOps`n" + ($issues -join "`n")
Write-Host $msg

if ($AlertWebhook -ne "") {
  try {
    $body = @{ text = $msg } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri $AlertWebhook -ContentType "application/json" -Body $body | Out-Null
    Write-Host "Alert sent to webhook."
  } catch {
    Write-Host "Failed to send webhook alert: $($_.Exception.Message)"
  }
}
exit 2