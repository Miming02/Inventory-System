# Ilagay ang opisyal na Supabase docker/ sa ./upstream/
# Mas mabilis: Git (docker folder lang). Fallback: malaking .tar.gz
# Run:  .\fetch-upstream.ps1
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Set-Location $here

if (Test-Path (Join-Path $here "upstream")) {
  Write-Host "May upstream/ na. Burahin muna kung gusto mong i-fetch ulit." -ForegroundColor Yellow
  exit 0
}

$tmpTgz = Join-Path $here "supabase-src.tgz"
$gitTmp = Join-Path $here "supabase-git-tmp"

function Remove-StaleTgz {
  if (Test-Path $tmpTgz) {
    Write-Host "Tinatanggal ang lumang supabase-src.tgz ..." -ForegroundColor Yellow
    try {
      Remove-Item -LiteralPath $tmpTgz -Force -ErrorAction Stop
    } catch {
      Write-Host "HINDI ma-delete ang supabase-src.tgz (locked / ginagamit pa)." -ForegroundColor Red
      Write-Host "Gawin: isara ang Cursor/VS Code, Task Manager: tapusin ang PowerShell/curl, tapos:" -ForegroundColor Cyan
      Write-Host "  .\delete-supabase-tgz.ps1" -ForegroundColor White
      throw "Kailangan muna ma-delete ang supabase-src.tgz"
    }
  }
}

function Fetch-ViaGit {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { return $false }

  if (Test-Path $gitTmp) {
    Remove-Item $gitTmp -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host ""
  Write-Host "=== Git: docker/ folder lang (mas mabilis kaysa buong .tar.gz) ===" -ForegroundColor Cyan
  $repo = "https://github.com/supabase/supabase.git"

  # --no-checkout: huwag i-unpack ang buong repo bago sparse (iwas sa libo-libong file sa supabase-git-tmp)
  & git clone --depth 1 --filter=blob:none --no-checkout $repo $gitTmp
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Git clone failed - susubukan ang ibang paraan..." -ForegroundColor DarkYellow
    if (Test-Path $gitTmp) { Remove-Item $gitTmp -Recurse -Force -ErrorAction SilentlyContinue }
    return $false
  }

  Push-Location $gitTmp
  try {
    git sparse-checkout init --cone 2>$null
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      Remove-Item (Join-Path $here "supabase-git-tmp") -Recurse -Force -ErrorAction SilentlyContinue
      return $false
    }
    git sparse-checkout set docker
    git checkout 2>$null
    if ($LASTEXITCODE -ne 0) {
      Pop-Location
      Remove-Item (Join-Path $here "supabase-git-tmp") -Recurse -Force -ErrorAction SilentlyContinue
      return $false
    }
  } finally {
    Pop-Location
  }

  $dockerPath = Join-Path $gitTmp "docker"
  if (-not (Test-Path $dockerPath)) {
    Remove-Item $gitTmp -Recurse -Force -ErrorAction SilentlyContinue
    return $false
  }

  Move-Item $dockerPath (Join-Path $here "upstream")
  Remove-Item $gitTmp -Recurse -Force -ErrorAction SilentlyContinue
  return $true
}

function Fetch-ViaTarball {
  Remove-StaleTgz

  $urls = @(
    "https://github.com/supabase/supabase/archive/refs/heads/master.tar.gz",
    "https://github.com/supabase/supabase/archive/refs/heads/main.tar.gz"
  )

  function Download-Archive {
    param([string]$Url, [string]$OutPath)
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
      # Single quotes: avoid '(' in double-quoted strings (PowerShell subexpression)
      Write-Host 'Dinada-download ang malaking archive gamit ang curl (matagal)...' -ForegroundColor Cyan
      & curl.exe -fL --progress-bar -o $OutPath $Url
      if ($LASTEXITCODE -ne 0) { throw "curl exit $LASTEXITCODE" }
      return
    }
    Write-Host 'Dinada-download gamit ang Invoke-WebRequest (matagal)...' -ForegroundColor Cyan
    Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing
  }

  Write-Host ""
  Write-Host '=== Fallback: buong repo archive (MALAKI - hintayin o gamitin ang Git) ===' -ForegroundColor Yellow

  $ok = $false
  foreach ($url in $urls) {
    try {
      Write-Host "Sinusubukan: $url" -ForegroundColor Gray
      Download-Archive -Url $url -OutPath $tmpTgz
      $ok = $true
      break
    } catch {
      Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
      if (Test-Path $tmpTgz) { Remove-Item $tmpTgz -Force -ErrorAction SilentlyContinue }
    }
  }
  if (-not $ok) { throw "Hindi na-download ang archive." }
  if (-not (Test-Path $tmpTgz)) { throw "Nawala ang download file." }

  Write-Host "Ini-extract..." -ForegroundColor Green
  tar -xzf $tmpTgz -C $here
  Remove-Item $tmpTgz -Force

  $dir = Get-ChildItem $here -Directory | Where-Object { $_.Name -like "supabase-*" } | Select-Object -First 1
  if (-not $dir) { throw "Walang na-extract na supabase-*" }

  $dockerSrc = Join-Path $dir.FullName "docker"
  if (-not (Test-Path $dockerSrc)) { throw "Walang docker/ sa archive" }

  Move-Item $dockerSrc (Join-Path $here "upstream")
  Remove-Item $dir.FullName -Recurse -Force
}

# --- main ---
try {
  if (-not (Fetch-ViaGit)) {
    Fetch-ViaTarball
  }
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

$envExample = Join-Path $here "upstream\.env.example"
if (Test-Path $envExample) {
  Copy-Item $envExample (Join-Path $here ".env.example") -Force
  Write-Host ""
  Write-Host "Na-copy ang .env.example sa backend\docker" -ForegroundColor Green
}

Write-Host ""
Write-Host "TAPOS. May upstream\ folder ka na." -ForegroundColor Cyan
Write-Host "Susunod: copy .env.example .env  tapos  docker compose up -d" -ForegroundColor Cyan
Write-Host ""
