$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$f = Join-Path $here "supabase-src.tgz"

if (-not (Test-Path $f)) {
  Write-Host "OK - walang supabase-src.tgz dito." -ForegroundColor Green
  exit 0
}

Write-Host "Tinatanggal: $f" -ForegroundColor Yellow
try { attrib -R $f } catch {}

try {
  Remove-Item -LiteralPath $f -Force
  Write-Host "Natanggal na." -ForegroundColor Green
  exit 0
} catch {
  Write-Host "PowerShell Remove-Item failed: $($_.Exception.Message)" -ForegroundColor Red
}

$code = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "del /f /q `"$f`"" -Wait -NoNewWindow -PassThru
if ($code.ExitCode -eq 0 -and -not (Test-Path $f)) {
  Write-Host "Natanggal gamit ang cmd del." -ForegroundColor Green
  exit 0
}

Write-Host "Subukan: Task Manager - tapusin ang PowerShell/curl; o i-restart ang PC." -ForegroundColor Yellow
exit 1
