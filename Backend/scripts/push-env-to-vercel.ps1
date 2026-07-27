# Pushes Backend/.env values to the maple-furnishers-backend Vercel project
# (production environment), with production-appropriate overrides:
#   - NODE_ENV        -> production
#   - CORS_ORIGINS    -> the deployed frontend origin only
#   - DATABASE_URL    -> Neon POOLED endpoint (serverless needs the pooler,
#                        or concurrent invocations exhaust direct connections)
#   - PORT            -> skipped (Vercel functions don't listen on a port)
#
# Run from the Backend folder:  .\scripts\push-env-to-vercel.ps1
# Idempotent: re-running overwrites existing values (--force).

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) { throw ".env not found next to scripts/ — run from Backend/" }

$overrides = @{
  "NODE_ENV"     = "production"
  "CORS_ORIGINS" = "https://maple-furnishers.vercel.app"
}
$skip = @("PORT")

foreach ($line in Get-Content $envFile) {
  $line = $line.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { continue }
  $idx = $line.IndexOf("=")
  if ($idx -lt 1) { continue }
  $name = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()

  if ($skip -contains $name) { Write-Host "skip  $name"; continue }
  if ($overrides.ContainsKey($name)) { $value = $overrides[$name] }

  # Neon serverless best practice: use the pooled endpoint in production.
  if ($name -eq "DATABASE_URL" -and $value -notmatch "-pooler\.") {
    $value = $value -replace "^(postgresql://[^@]+@ep-[a-z0-9-]+)(\.)", '$1-pooler$2'
  }

  Write-Host "push  $name"
  $value | vercel env add $name production --force | Out-Null
}

Write-Host ""
Write-Host "Done. Deploy with:  vercel deploy --prod --yes"
