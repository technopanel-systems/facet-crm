# Makes sure FACET is reachable at http://localhost:3000: Docker Desktop up,
# the db container healthy, the app container NOT holding port 3000 (its image
# goes stale), and a local "next start" serving the current build on 3000.
# Safe to re-run any time; it just checks each step and fixes what's off.

$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Write-Step($msg) { Write-Host "-> $msg" }
function Run-Quiet($exe, $argList) {
    try { & $exe @argList *>$null 2>&1 } catch {}
}

# 1. Docker Desktop
try { docker info *>$null 2>&1 } catch {}
if ($LASTEXITCODE -ne 0) {
    Write-Step "Docker is down - starting Docker Desktop..."
    Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    do {
        Start-Sleep -Seconds 2
        try { docker info *>$null 2>&1 } catch {}
    } while ($LASTEXITCODE -ne 0)
    Write-Step "Docker is up."
} else {
    Write-Step "Docker already up."
}

# 2. db container healthy
Run-Quiet "docker" @("compose", "up", "-d", "db")
do {
    Start-Sleep -Seconds 2
    $health = & docker inspect facet-crm-db-1 --format '{{.State.Health.Status}}' 2>$null
} while ($health -ne "healthy")
Write-Step "db container healthy."

# 3. app container must not hold port 3000 (stale image) - disable its
#    auto-restart and stop it every run, since Docker restarting revives it.
Run-Quiet "docker" @("update", "--restart=no", "facet-crm-app-1")
Run-Quiet "docker" @("compose", "stop", "app")
Write-Step "app container stopped (restart policy disabled)."

# 4. local build serving port 3000
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
$ownedByNode = $listener | Where-Object {
    (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -eq "node"
}
if (-not $ownedByNode) {
    if ($listener) {
        Write-Step "Port 3000 held by a non-node process - killing it."
        $listener | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    }
    Write-Step "Starting 'next start' on port 3000..."
    $log = Join-Path $env:TEMP "facet-app.log"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx next start -p 3000" -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds(60)
    do {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 3
            $ok = $resp.StatusCode -eq 200
        } catch { $ok = $false }
    } until ($ok -or (Get-Date) -gt $deadline)
} else {
    Write-Step "App already running on port 3000."
}

# 5. final check
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host ""
    Write-Host "FACET is running: http://localhost:3000  (health $($resp.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "FACET did NOT come up - check $env:TEMP\facet-app.log" -ForegroundColor Red
    exit 1
}
