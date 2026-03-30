$ErrorActionPreference = "Stop"

$ProjectPath = "c:\Users\aaa\Downloads\svarus darbas 1\svarus-darbas-1"
$LogDir = Join-Path $ProjectPath ".always-on"
$LogFile = Join-Path $LogDir "worker.log"
$MutexName = "Global\SvarusDarbasCRMAlwaysOnWorker"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line
}

function Get-ViteProcess {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
    return $processes | Where-Object {
        $_.CommandLine -like "*vite*" -and $_.CommandLine -like "*--port=3000*"
    }
}

function Start-DevServer {
    Write-Log "Starting dev server (npm run dev)..."
    Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$ProjectPath`" && npm run dev"
}

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $MutexName, [ref]$createdNew)
if (-not $createdNew) {
    Write-Log "Another worker instance is already running. Exiting duplicate instance."
    exit 0
}

Write-Log "Always-on worker started."

$lastLintAt = Get-Date "2000-01-01"
$lastFetchAt = Get-Date "2000-01-01"
$lastBuildAt = Get-Date "2000-01-01"
$lastScoutAt = Get-Date "2000-01-01"
$lastHeartbeatAt = Get-Date "2000-01-01"

try {
    while ($true) {
        try {
            Set-Location $ProjectPath

            $vite = Get-ViteProcess
            if (-not $vite) {
                Start-DevServer
            }

            if (((Get-Date) - $lastLintAt).TotalMinutes -ge 20) {
                Write-Log "Running lint check..."
                cmd /c "cd /d `"$ProjectPath`" && npm run lint" | Out-Null
                Write-Log "Lint check finished."
                $lastLintAt = Get-Date
            }

            if (((Get-Date) - $lastFetchAt).TotalMinutes -ge 30) {
                Write-Log "Running git fetch --all --prune..."
                cmd /c "cd /d `"$ProjectPath`" && git fetch --all --prune" | Out-Null
                Write-Log "Git fetch finished."
                $lastFetchAt = Get-Date
            }

            if (((Get-Date) - $lastBuildAt).TotalMinutes -ge 60) {
                Write-Log "Running build check..."
                cmd /c "cd /d `"$ProjectPath`" && npm run build" | Out-Null
                Write-Log "Build check finished."
                $lastBuildAt = Get-Date
            }

            if (((Get-Date) - $lastScoutAt).TotalMinutes -ge 25) {
                Write-Log "Running improvement scout..."
                cmd /c "cd /d `"$ProjectPath`" && npm run scout:improvements" | Out-Null
                Write-Log "Improvement scout finished."
                $lastScoutAt = Get-Date
            }

            if (((Get-Date) - $lastHeartbeatAt).TotalMinutes -ge 5) {
                $viteCount = @(Get-ViteProcess).Count
                $health = "down"
                try {
                    $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 4
                    if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $health = "ok" }
                }
                catch { }
                Write-Log "Heartbeat: worker alive, vite_instances=$viteCount, app_health=$health, scout_ready=true"
                $lastHeartbeatAt = Get-Date
            }
        }
        catch {
            Write-Log ("Worker error: " + $_.Exception.Message)
        }

        Start-Sleep -Seconds 45
    }
}
finally {
    if ($null -ne $mutex) {
        $mutex.ReleaseMutex() | Out-Null
        $mutex.Dispose()
    }
}
