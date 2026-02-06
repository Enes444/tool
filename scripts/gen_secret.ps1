# Generates a strong secret for SPONSOR_OPS_JWT_SECRET (Base64, 64 chars+)
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
Write-Output $secret