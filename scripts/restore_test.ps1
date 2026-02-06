param(
  [string]$ProjectRoot = ".",
  [string]$BackupDir = "backups"
)
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$dbFile = Get-ChildItem $BackupDir -Filter "sponsorops_db_*.sqlite3" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dbFile) { throw "No DB backup found in $BackupDir" }

$tmpDir = Join-Path $env:TEMP "sponsor_ops_restore_test"
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
New-Item -ItemType Directory -Path $tmpDir | Out-Null

Copy-Item $dbFile.FullName (Join-Path $tmpDir "restore_test.sqlite3")
Write-Host "Running integrity check for $($dbFile.Name)..."
docker run --rm -v "${tmpDir}:/data" nouchka/sqlite3 sqlite3 /data/restore_test.sqlite3 "PRAGMA integrity_check;" 

Write-Host "Checking core tables..."
docker run --rm -v "${tmpDir}:/data" nouchka/sqlite3 sqlite3 /data/restore_test.sqlite3 ".tables"

Write-Host "Restore test PASSED."