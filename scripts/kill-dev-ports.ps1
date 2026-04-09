# Atlaisvina CRM dev prievadus (Windows): 3001 = server.cjs, 5173 = Vite, 4173 = vite preview (Playwright E2E).
# Paleiskite PRIEŠ npm run dev:full arba npm run verify, jei liko „pakibęs“ preview ir testai stringa.
$ErrorActionPreference = "SilentlyContinue"

$toKill = New-Object 'System.Collections.Generic.HashSet[int]'

try {
    foreach ($port in 3001, 5173, 4173) {
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
        if ($line -notmatch '[:.](3001|5173|4173)\s') { continue }
        $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
        $last = $parts[-1]
        if ($last -match '^\d+$') {
            $procId = [int]$last
            if ($procId -gt 0) { [void]$toKill.Add($procId) }
        }
    }
}

foreach ($procId in $toKill) {
    Write-Host "Stopping PID $procId (CRM dev port 3001 / 5173 / 4173)..."
    taskkill /PID $procId /F /T 2>$null | Out-Null
}

if ($toKill.Count -eq 0) {
    Write-Host "Ports 3001, 5173, 4173: nothing to stop."
}

exit 0
