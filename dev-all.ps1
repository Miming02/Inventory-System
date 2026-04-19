# Isang terminal: local Supabase (Docker) + Vite frontend.
# - Docker: buong stack sa backend/docker (Postgres, Auth, Kong, atbp.) - hiwalay sa Supabase cloud.
# - Frontend: npm run dev (gumagamit pa rin ng laman ng frontend/.env - cloud o local URL).
param(
  [switch] $SkipDocker
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dockerDir = Join-Path $root "backend\docker"
$frontendDir = Join-Path $root "frontend"
$composeFile = Join-Path $dockerDir "upstream\docker-compose.yml"
$envFile = Join-Path $dockerDir ".env"

if (-not (Test-Path (Join-Path $frontendDir "package.json"))) {
  throw "Hindi nahanap ang frontend/package.json (tumakbo mula sa repo root)."
}

if (-not $SkipDocker) {
  if (-not (Test-Path $composeFile)) {
    Write-Host "Walang upstream/docker-compose.yml. Sa backend\docker patakbuhin: .\fetch-upstream.ps1" -ForegroundColor Red
    exit 1
  }
  if (-not (Test-Path $envFile)) {
    Write-Host "Walang backend\docker\.env - kopyahin mula sa .env.example doon." -ForegroundColor Red
    exit 1
  }

  Write-Host ""
  Write-Host "Docker: ina-start ang local Supabase (inventory-supabase)..." -ForegroundColor Cyan
  Write-Host "  Kung naka-cloud ang frontend/.env, hindi ginagamit ng app ang stack na ito - pwede mong gamitin -SkipDocker." -ForegroundColor DarkGray
  Write-Host ""

  Set-Location $dockerDir
  & docker compose -f $composeFile --env-file $envFile --project-name inventory-supabase up -d
  $dc = $LASTEXITCODE
  Set-Location $root
  if ($dc -ne 0) {
    Write-Host "docker compose nag-exit sa code $dc (buksan ang Docker Desktop, tingnan ang ports)." -ForegroundColor Red
    exit $dc
  }

  Write-Host "Docker: tapos na (detached). Susunod: Vite..." -ForegroundColor Green
  Write-Host ""
}

Set-Location $frontendDir
npm run dev
