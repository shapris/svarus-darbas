$ErrorActionPreference = 'Stop'

param(
  [string]$Environment = 'production'
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path ".env")) {
  Write-Error ".env failas nerastas projekte."
}

function Get-EnvMap {
  param([string]$Path)
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    $map[$k] = $v
  }
  return $map
}

$envMap = Get-EnvMap ".env"
$keys = @(
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_OPENROUTER_API_KEY",
  "VITE_GEMINI_API_KEY",
  "VITE_GOOGLE_MAPS_API_KEY",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "VITE_INVOICE_API_BASE_URL",
  "VITE_DEMO_MODE",
  "VITE_USE_FIREBASE"
)

Write-Host "Tikrinamas vercel prisijungimas..."
npx vercel whoami | Out-Null

Write-Host "Keliami env i Vercel ($Environment)..."
foreach ($key in $keys) {
  if (-not $envMap.ContainsKey($key)) { continue }
  $value = [string]$envMap[$key]
  if ([string]::IsNullOrWhiteSpace($value)) { continue }
  Write-Host " -> $key"
  $value | npx vercel env add $key $Environment --force
}

Write-Host "`nBaigta. Paleiskite deploy:"
Write-Host "npx vercel --prod"
