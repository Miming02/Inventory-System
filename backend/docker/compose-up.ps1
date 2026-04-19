param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ComposeArgs
)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Set-Location $here

$composeFile = Join-Path $here "upstream\docker-compose.yml"
if (-not (Test-Path $composeFile)) {
  Write-Host "Missing upstream/docker-compose.yml. Run .\fetch-upstream.ps1 first." -ForegroundColor Red
  exit 1
}
$envFile = Join-Path $here ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Missing .env - copy .env.example to .env and set secrets." -ForegroundColor Red
  exit 1
}

& docker compose -f $composeFile --env-file $envFile --project-name inventory-supabase @ComposeArgs
