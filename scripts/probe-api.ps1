#requires -Version 5.1
<#
.SYNOPSIS
  Tikrina API per curl.exe (ne PowerShell alias „curl“).

.EXAMPLE
  npm run probe:api
.EXAMPLE
  npm run probe:api:local
.EXAMPLE
  .\scripts\probe-api.ps1 -Base "https://api.example.com" -Front "https://crm.vercel.app"
#>
param(
  [string] $Base = "",
  [string] $Front = "",
  [switch] $Local
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
  $OutputEncoding = [System.Text.UTF8Encoding]::new()
}
catch { }

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Read-DotEnv([string] $path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $map }
  Get-Content -LiteralPath $path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1).Trim()
    $map[$k] = $v
  }
  return $map
}

if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
  Write-Host "KLAIDA: curl.exe nerastas PATH." -ForegroundColor Red
  exit 1
}

$envMap = Read-DotEnv (Join-Path $RepoRoot '.env')

$urlBase = $Base.Trim().TrimEnd('/')
if ($Local) {
  $port = if ($env:PORT) { $env:PORT } else { '3001' }
  $urlBase = "http://127.0.0.1:$port"
}
if (-not $urlBase) {
  $fromEnv = [string] $envMap['VITE_INVOICE_API_BASE_URL']
  if ($fromEnv) { $urlBase = $fromEnv.Trim().TrimEnd('/') }
}
if (-not $urlBase) {
  $urlBase = 'https://svarus-darbas-api.onrender.com'
}

function Get-CurlText([string] $url) {
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    $code = & curl.exe -sS -H 'Accept: application/json' -o $tmp -w '%{http_code}' --max-time 30 $url 2>&1
    $raw = if (Test-Path $tmp) { Get-Content -LiteralPath $tmp -Raw -Encoding UTF8 } else { '' }
    return @{ Code = [string]$code; Body = $raw }
  }
  finally {
    if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
}

Write-Host ""
Write-Host "=== probe-api (curl.exe) ===" -ForegroundColor Green
Write-Host "Repo: $RepoRoot"
Write-Host "API base: $urlBase"

$paths = @(
  '/health',
  '/api/ai/health',
  '/api/client-service-requests'
)

foreach ($path in $paths) {
  $u = "$urlBase$path"
  Write-Host ""
  Write-Host "--- GET $path ---" -ForegroundColor Cyan
  Write-Host $u
  $r = Get-CurlText $u
  Write-Host "HTTP $($r.Code)"
  $body = $r.Body
  if ($body -and $body.Length -gt 1600) {
    $body = $body.Substring(0, 1600) + "`n... (nuotrumpinta)"
  }
  if ($body -and $r.Code -eq '200' -and ($body.TrimStart().StartsWith('{'))) {
    try {
      $obj = $body | ConvertFrom-Json
      $body = ($obj | ConvertTo-Json -Depth 8)
    }
    catch { }
  }
  if ($body) { Write-Host $body }
}

$chatUrl = "$urlBase/api/ai/chat"
Write-Host ""
Write-Host "--- POST /api/ai/chat ({} ) ---" -ForegroundColor Cyan
Write-Host $chatUrl
$tmp2 = [System.IO.Path]::GetTempFileName()
try {
  $code = & curl.exe -sS -o $tmp2 -w '%{http_code}' --max-time 30 -X POST -H 'Content-Type: application/json' --data '{}' $chatUrl 2>&1
  Write-Host "HTTP $code"
  $errBody = if (Test-Path $tmp2) { Get-Content -LiteralPath $tmp2 -Raw -Encoding UTF8 } else { '' }
  if ($errBody -and $errBody.Length -gt 600) { $errBody = $errBody.Substring(0, 600) + '...' }
  if ($errBody) { Write-Host $errBody }
}
finally {
  if (Test-Path $tmp2) { Remove-Item -LiteralPath $tmp2 -Force -ErrorAction SilentlyContinue }
}

$frontUrl = $Front.Trim()
if ($frontUrl) {
  $frontUrl = $frontUrl.Trim().TrimEnd('/')
  Write-Host ""
  Write-Host "--- GET CRM (per -Front) ---" -ForegroundColor Cyan
  Write-Host "$frontUrl/"
  $fc = & curl.exe -sS -o NUL -w '%{http_code}' --max-time 25 -L "$frontUrl/" 2>&1
  Write-Host "HTTP $fc"
}

Write-Host ""
Write-Host "Baigta." -ForegroundColor Green
