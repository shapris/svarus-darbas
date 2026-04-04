# Vietinis CRM be Supabase — tas pats principas kaip `npm run build:e2e` + Playwright (.env.e2e).
# Naudojimas: npm run dev:local
# Tada naršyklėje: http://127.0.0.1:5173/ — turi matytis prisijungimo ekranas, ne tik „backend setup“.

$ErrorActionPreference = 'Stop'
$env:VITE_ALLOW_OFFLINE_CRM = 'true'
if (-not $env:VITE_CLIENT_SELF_REGISTRATION) {
  $env:VITE_CLIENT_SELF_REGISTRATION = 'true'
}
if (-not $env:VITE_OPEN_BROWSER) {
  $env:VITE_OPEN_BROWSER = 'false'
}

Write-Host ''
Write-Host '[dev:local] VITE_ALLOW_OFFLINE_CRM=true (vietinis CRM, localStorage).'
Write-Host '[dev:local] URL: http://127.0.0.1:5173/'
Write-Host ''

npm run dev
