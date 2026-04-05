$ErrorActionPreference = "Stop"

# Repo šaknis = katalogas virš `scripts/` (veikia bet kuriame klonuotame kelyje).
$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $ProjectPath ".always-on"
$BacklogPath = Join-Path $OutDir "improvement-backlog.md"
$StatePath = Join-Path $OutDir "improvement-state.json"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

Set-Location $ProjectPath

$codePatterns = @("*.ts", "*.tsx", "*.js", "*.jsx")
$codeFiles = @(
    Get-ChildItem -Path "src" -Recurse -File -Include $codePatterns -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\tests?\\' -and $_.Name -notmatch '\.(test|spec)\.(ts|tsx|js|jsx)$' }
)

function Count-Matches {
    param(
        [string[]]$Patterns
    )
    if (-not $codeFiles -or $codeFiles.Count -eq 0) { return 0 }
    $sum = 0
    foreach ($p in $Patterns) {
        $sum += @(
            Select-String -Path $codeFiles.FullName -Pattern $p -AllMatches -CaseSensitive:$false -ErrorAction SilentlyContinue
        ).Count
    }
    return $sum
}

function Top-LargestFiles {
    if (-not $codeFiles -or $codeFiles.Count -eq 0) { return @() }
    $projectPrefix = [Regex]::Escape($ProjectPath + "\")
    return $codeFiles |
        Sort-Object Length -Descending |
        Select-Object -First 5 |
        ForEach-Object {
            $relative = $_.FullName -replace $projectPrefix, ""
            "{0} ({1} KB)" -f $relative, [math]::Round($_.Length / 1KB, 1)
        }
}

$todoCount = Count-Matches @("TODO", "FIXME", "HACK")
$consoleErrorCount = Count-Matches @("console\.error\(")
# Tikras window.alert kvietimas — ne „role=alert“, ne komentarai „Proactive alerts“.
$alertCount = Count-Matches @("\balert\s*\(")
$anyCount = Count-Matches @("\bas\s+any\b", ":\s*any\b")

$largest = Top-LargestFiles
$largestText = if ($largest.Count -gt 0) { ($largest -join "; ") } else { "N/A" }

$auditHigh = 0
$auditModerate = 0
try {
    $auditRaw = npm audit --json 2>$null
    if ($auditRaw) {
        $audit = $auditRaw | ConvertFrom-Json
        if ($audit.metadata -and $audit.metadata.vulnerabilities) {
            $auditHigh = [int]($audit.metadata.vulnerabilities.high)
            $auditModerate = [int]($audit.metadata.vulnerabilities.moderate)
        }
    }
} catch {
    # ignore audit parse failures
}

$score = 100
$score -= [Math]::Min(20, $todoCount)
$score -= [Math]::Min(10, $consoleErrorCount)
$score -= [Math]::Min(10, $alertCount * 2)
$score -= [Math]::Min(15, [int]($anyCount / 3))
$score -= [Math]::Min(15, $auditHigh * 3 + $auditModerate)
if ($score -lt 0) { $score = 0 }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$actions = @()
if ($alertCount -gt 0) { $actions += "- Replace remaining alert(...) calls with toast notifications." }
if ($consoleErrorCount -gt 20) { $actions += "- Reduce noisy console.error(...) paths in runtime flows and keep only actionable logs." }
if ($anyCount -gt 0) { $actions += "- Decrease any usage in top active modules by introducing strict local types." }
if ($todoCount -gt 0) { $actions += "- Resolve highest-impact TODO/FIXME items first (data integrity, scheduling, auth)." }
if ($auditHigh -gt 0 -or $auditModerate -gt 0) { $actions += "- Review dependency vulnerabilities and patch non-breaking updates." }
if ($actions.Count -eq 0) { $actions += "- Maintain current baseline and continue periodic checks." }

$md = @"
# Improvement Backlog

Generated: $timestamp

## Health Score

- Score: **$score / 100**

## Signals

- **Scope:** only `src/**/*.ts(x)` and `js(x)` (excludes `*.test.*`, `*.spec.*`, and any `src/tests` tree).
- TODO/FIXME/HACK count: **$todoCount**
- console.error(...) count: **$consoleErrorCount**
- alert(...) count: **$alertCount**
- any usage count: **$anyCount**
- NPM audit high/moderate: **$auditHigh / $auditModerate**
- Largest code files: **$largestText**

## Next Actions (Auto-Prioritized)

$(($actions -join "`n"))
"@

Set-Content -Path $BacklogPath -Value $md -Encoding UTF8

$state = @{
    generatedAt = $timestamp
    score = $score
    todoCount = $todoCount
    consoleErrorCount = $consoleErrorCount
    alertCount = $alertCount
    anyCount = $anyCount
    auditHigh = $auditHigh
    auditModerate = $auditModerate
} | ConvertTo-Json -Depth 4

Set-Content -Path $StatePath -Value $state -Encoding UTF8

Write-Output "Improvement scout completed. Score=$score"
