# Creates a local Auth user + sets Admin on public.profiles (needs migrations applied).
# Why: self-hosted Postgres has no users from cloud - "Invalid login credentials" until you add one.
param(
  [string] $Email = "dev@local.test",
  [string] $Password = "LocalDev123!",
  [string] $BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$envFile = Join-Path $here ".env"
if (-not (Test-Path $envFile)) { throw "Missing .env - copy .env.example to .env and start Docker." }

function Get-DotEnvValue([string] $key) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*#") { continue }
    if ($line -match "^\s*$") { continue }
    if ($line -match "^$([regex]::Escape($key))=(.*)$") { return $Matches[1].Trim() }
  }
  return $null
}

$serviceKey = Get-DotEnvValue "SERVICE_ROLE_KEY"
if (-not $serviceKey) { throw "SERVICE_ROLE_KEY not found in .env" }

$authHeaders = @{
  apikey            = $serviceKey
  Authorization     = "Bearer $serviceKey"
  "Content-Type"    = "application/json"
}

function Invoke-GoTrueAdminPostUser {
  $bodyObj = @{ email = $Email; password = $Password; email_confirm = $true }
  $body = $bodyObj | ConvertTo-Json
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/auth/v1/admin/users" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing
    return ($r.Content | ConvertFrom-Json)
  }
  catch {
    $resp = $_.Exception.Response
    if (-not $resp) { throw }
    $code = [int]$resp.StatusCode
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $txt = $reader.ReadToEnd()
    if ($code -eq 422 -and $txt -match "already|registered|exists") {
      return $null
    }
    throw "Auth admin POST failed ($code): $txt"
  }
}

function Find-UserIdByEmail {
  $page = 1
  while ($page -le 20) {
    $uri = "$BaseUrl/auth/v1/admin/users?page=$page" + '&per_page=100'
    $r = Invoke-RestMethod -Uri $uri -Headers @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" } -Method Get
    if ($null -eq $r.users) { break }
    $list = @($r.users)
    foreach ($u in $list) {
      if ($u.email -eq $Email) { return $u.id }
    }
    if ($list.Count -lt 100) { break }
    $page++
  }
  return $null
}

Write-Host "Creating Auth user (Kong must be up at $BaseUrl)..." -ForegroundColor Cyan
$user = Invoke-GoTrueAdminPostUser
if (-not $user) {
  Write-Host "User already exists for $Email - fetching id..." -ForegroundColor Yellow
  $uid = Find-UserIdByEmail
  if (-not $uid) { throw "Could not resolve user id for $Email" }
  $user = [PSCustomObject]@{ id = $uid }
}
else {
  Write-Host "Created user id $($user.id)" -ForegroundColor Green
}

$restHeaders = @{
  apikey            = $serviceKey
  Authorization     = "Bearer $serviceKey"
  "Content-Type"    = "application/json"
  Prefer            = "return=representation"
}

Write-Host "Setting Admin role on profiles..." -ForegroundColor Cyan
try {
  $rolesUri = "$BaseUrl/rest/v1/roles?name=eq.Admin" + '&select=id'
  $roles = Invoke-RestMethod -Uri $rolesUri -Headers $restHeaders -Method Get
  if (-not $roles -or $roles.Count -eq 0) {
    Write-Warning "No Admin role in public.roles - run apply-migrations.ps1 first. Login may work but routes need a role."
  }
  else {
    $adminId = $roles[0].id
    $patch = (@{ role_id = $adminId } | ConvertTo-Json -Compress)
    $patchUri = "$BaseUrl/rest/v1/profiles?id=eq.$($user.id)"
    $p = Invoke-WebRequest -Uri $patchUri -Method Patch -Headers $restHeaders -Body $patch -UseBasicParsing
    if ($p.StatusCode -ne 200 -and $p.StatusCode -ne 204) {
      Write-Warning "Unexpected PATCH status $($p.StatusCode)"
    }
    Write-Host "Profile updated with Admin role." -ForegroundColor Green
  }
}
catch {
  Write-Warning "Could not PATCH profiles (migrations / RLS?): $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Log in sa app gamit ang:" -ForegroundColor White
Write-Host "  Email:    $Email" -ForegroundColor White
Write-Host "  Password: $Password" -ForegroundColor White
Write-Host ""
