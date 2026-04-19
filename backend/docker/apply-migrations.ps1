$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$migrationsDir = Resolve-Path (Join-Path $here "..\supabase\migrations")
$composeFile = Join-Path $here "upstream\docker-compose.yml"
$envFile = Join-Path $here ".env"

if (-not (Test-Path $composeFile)) { throw "Missing upstream/docker-compose.yml - run fetch-upstream.ps1 first." }
if (-not (Test-Path $envFile)) { throw "Missing .env" }

Write-Warning "Ito ay magpapatakbo ng lahat ng *.sql laban sa Postgres. Type YES para ituloy."
if ((Read-Host) -ne "YES") { exit 0 }

$files = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name
foreach ($f in $files) {
  Write-Host ">>> $($f.Name) ..." -ForegroundColor Cyan
  Get-Content $f.FullName -Raw | & docker compose -f $composeFile --env-file $envFile --project-name inventory-supabase exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "Failed: $($f.Name)" }
}
Write-Host "Done." -ForegroundColor Green
