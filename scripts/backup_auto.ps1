param(
  [string]$ProjectRoot = ".",
  [string]$BackupDir = "backups",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$dbOut = Join-Path $BackupDir "sponsorops_db_$ts.sqlite3"
$uploadsOut = Join-Path $BackupDir "uploads_$ts.zip"

Write-Host "Creating SQLite backup -> $dbOut"
docker compose exec -T api sh -lc "sqlite3 /data/sponsor_ops.db '.backup /tmp/backup.sqlite3'" | Out-Null
docker cp "$(docker compose ps -q api):/tmp/backup.sqlite3" $dbOut | Out-Null
docker compose exec -T api sh -lc "rm -f /tmp/backup.sqlite3" | Out-Null

Write-Host "Creating uploads backup -> $uploadsOut"
if (Test-Path "backend/uploads") {
  Compress-Archive -Path "backend/uploads/*" -DestinationPath $uploadsOut -Force
} else {
  Write-Host "No backend/uploads found, skipping uploads zip."
}

Write-Host "Pruning backups older than $KeepDays days..."
Get-ChildItem $BackupDir -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force

Write-Host "Backup completed."
Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending | Select-Object -First 6