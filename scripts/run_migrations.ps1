Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Push-Location backend
try { alembic upgrade head } finally { Pop-Location }
