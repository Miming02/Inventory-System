# Burahin ang supabase-git-tmp kung lumaki / buong monorepo ang na-clone (maling paraan dati).
# Puwedeng matagal kung maraming file.
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$d = Join-Path $here "supabase-git-tmp"

if (-not (Test-Path $d)) {
  Write-Host "OK - walang supabase-git-tmp." -ForegroundColor Green
  exit 0
}

Write-Host "Binubura ang supabase-git-tmp (malaki ito minsan, hintayin)..." -ForegroundColor Yellow
Remove-Item -LiteralPath $d -Recurse -Force
Write-Host "Tapos na." -ForegroundColor Green
