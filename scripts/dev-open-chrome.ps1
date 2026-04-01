# Atidaro švarų Chrome langą su dev URL (po ~2 s — laiko serveriui pasikelti).
# Naudojimas: npm run dev kitame lange, tada: powershell -File scripts/dev-open-chrome.ps1
# Arba: $env:DEV_URL = 'http://127.0.0.1:5173/'; .\scripts\dev-open-chrome.ps1

$ErrorActionPreference = 'Stop'
$url = if ($env:DEV_URL) { $env:DEV_URL } else { 'http://127.0.0.1:5173/' }

$c1 = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$c2 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"

Start-Sleep -Seconds 2
if (Test-Path $c1) {
    Start-Process $c1 @($url, '--new-window')
} elseif (Test-Path $c2) {
    Start-Process $c2 @($url, '--new-window')
} else {
    Start-Process $url
}
