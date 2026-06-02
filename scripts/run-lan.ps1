<#
  run-lan.ps1 - bring up MOTOGIATHINH test instances on the LAN.

  Starts 3 detached instances so multiple accounts can be logged in at once
  from any device on the same Wi-Fi. Use a DIFFERENT BROWSER (or an incognito
  window) per login - each browser keeps its own cookie jar, so sessions stay
  separate even on the same port. No app code is changed; pure orchestration.

    1. Webapp  (admin dashboard)  -> http://<LAN>:3001/   [also serves the API]
    2. Webapp  (admin dashboard)  -> http://<LAN>:3002/
    3. Guest app (collaborator)   -> http://<LAN>:5173/   [talks to :3001]

  The two backends share one seeded SQLite DB (WAL + busy_timeout). They are
  started readiness-gated (A must answer /api/health before B starts) to avoid
  a transient boot-time write collision on the shared DB. The per-process
  notification recompute timer may log an occasional caught "SQLITE_BUSY" when
  both backends recompute at the same 5-min tick - harmless, data converges.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\run-lan.ps1
    powershell -ExecutionPolicy Bypass -File scripts\run-lan.ps1 -LanIp 192.168.1.50
    powershell -ExecutionPolicy Bypass -File scripts\run-lan.ps1 -Stop   # tear down
#>
param(
  [string]$LanIp = "",
  [int]$WebPortA = 3001,
  [int]$WebPortB = 3002,
  [int]$GuestPort = 5173,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
$root    = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend\server.js"
$guest   = Join-Path $root "guest-app"
$viteBin = Join-Path $guest "node_modules\vite\bin\vite.js"
$pidFile = Join-Path $PSScriptRoot ".lan-pids.txt"

function Port-Listening($port) {
  return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

# --- teardown: kill whatever listens on our ports, plus recorded PIDs ------
if ($Stop) {
  $killed = @()
  foreach ($c in (Get-NetTCPConnection -State Listen -LocalPort @($WebPortA,$WebPortB,$GuestPort) -ErrorAction SilentlyContinue)) {
    $procId = [int]$c.OwningProcess
    if ($procId -and $killed -notcontains $procId) {
      try { Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Host "Stopped PID $procId (port $($c.LocalPort))"; $killed += $procId } catch {}
    }
  }
  if (Test-Path $pidFile) {
    foreach ($line in Get-Content $pidFile) {
      $procId = 0
      if ([int]::TryParse($line, [ref]$procId) -and $killed -notcontains $procId) {
        try { Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Host "Stopped PID $procId (recorded)"; $killed += $procId } catch {}
      }
    }
    Remove-Item $pidFile -Force
  }
  if (-not $killed) { Write-Host "Nothing was running on $WebPortA, $WebPortB, $GuestPort." }
  return
}

# --- detect LAN IP --------------------------------------------------------
if (-not $LanIp) {
  $LanIp = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "127.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if (-not $LanIp) { $LanIp = "127.0.0.1" }
}

# --- helpers --------------------------------------------------------------
function Wait-Health($url, $name) {
  for ($i = 0; $i -lt 24; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { Write-Host "  [OK]   $name  $url"; return $true }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  Write-Host "  [WARN] $name not responding yet at $url"
  return $false
}

# Start a backend on $port only if the port is free; wait until it's healthy
# before returning so the next instance never races it on the shared DB.
function Start-Backend($port) {
  if (Port-Listening $port) { Write-Host "  [skip] port $port already in use - leaving it as is"; return }
  $env:NODE_ENV = "development"; $env:PORT = "$port"
  $p = Start-Process node -ArgumentList "`"$backend`"" -WindowStyle Minimized -PassThru
  $script:pids += $p.Id
  Wait-Health "http://127.0.0.1:$port/api/health" "webapp :$port" | Out-Null
}

# --- launch ---------------------------------------------------------------
$script:pids = @()
Write-Host ""
Write-Host "Starting MOTOGIATHINH LAN instances..."

Start-Backend $WebPortA
Start-Backend $WebPortB

if (Port-Listening $GuestPort) {
  Write-Host "  [skip] port $GuestPort already in use - leaving it as is"
} else {
  # vite.config already binds 0.0.0.0; .env.development already points
  # VITE_API_BASE at the LAN backend on :3001. Run vite directly via node so
  # the tracked PID IS the listener (clean teardown, no cmd-wrapper orphan).
  $pg = Start-Process node -ArgumentList "`"$viteBin`"","--port","$GuestPort" -WorkingDirectory $guest -WindowStyle Minimized -PassThru
  $script:pids += $pg.Id
  Wait-Health "http://127.0.0.1:$GuestPort/" "guest app :$GuestPort" | Out-Null
}

if ($script:pids.Count -gt 0) { $script:pids | Set-Content $pidFile }

Write-Host "------------------------------------------------------------"
Write-Host "  Webapp (admin dashboard) : http://${LanIp}:${WebPortA}/"
Write-Host "  Webapp (admin dashboard) : http://${LanIp}:${WebPortB}/"
Write-Host "  Guest app (collaborator) : http://${LanIp}:${GuestPort}/"
Write-Host "------------------------------------------------------------"
Write-Host "Open each in a DIFFERENT browser (or incognito) to keep logins separate."
Write-Host "Stop all:  powershell -ExecutionPolicy Bypass -File scripts\run-lan.ps1 -Stop"
