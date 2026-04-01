# Atlaisvina CRM dev prievadus (Windows): 3001 = server.cjs, 5173 = Vite.
# Paleiskite PRIEŠ npm run dev:full (arba naudokite npm run dev:full — jis kviečia tai automatiškai).
$ErrorActionPreference = "SilentlyContinue"

$toKill = New-Object 'System.Collections.Generic.HashSet[int]'

try {
    foreach ($port in 3001, 5173) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
            $procId = [int]$_.OwningProcess
            if ($procId -gt 0) { [void]$toKill.Add($procId) }
        }
    }
} catch {
    $toKill.Clear()
}

if ($toKill.Count -eq 0) {
    foreach ($line in (netstat -ano)) {
        if ($line -notmatch 'LISTENING') { continue }
        if ($line -notmatch '[:.](3001|5173)\s') { continue }
        $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
        $last = $parts[-1]
        if ($last -match '^\d+$') {
            $procId = [int]$last
            if ($procId -gt 0) { [void]$toKill.Add($procId) }
        }
    }
}

foreach ($procId in $toKill) {
    Write-Host "Stopping PID $procId (port 3001 or 5173)..."
    taskkill /PID $procId /F /T 2>$null | Out-Null
}

if ($toKill.Count -eq 0) {
    Write-Host "Ports 3001 and 5173: nothing to stop."
}

exit 0
