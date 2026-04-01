$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$pidFile = Join-Path $localDir 'game-server.pid'
$urlFile = Join-Path $localDir 'game-url.txt'
$browserFile = Join-Path $localDir 'game-browser.txt'
$outLog = Join-Path $localDir 'game-server.out.log'
$errLog = Join-Path $localDir 'game-server.err.log'

foreach ($f in @($urlFile, $browserFile)) {
  if (Test-Path $f) { Remove-Item $f -Force }
}

if (Test-Path $pidFile) {
  $oldPid = (Get-Content $pidFile -Raw).Trim()
  if ($oldPid) {
    try {
      $p = Get-Process -Id ([int]$oldPid) -ErrorAction Stop
      if ($p) {
        Write-Output "Game server already running on PID $oldPid"
      }
    } catch {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

$serverPid = $null
if (Test-Path $pidFile) {
  $serverPid = [int](Get-Content $pidFile -Raw)
}

if (-not $serverPid) {
  $server = Start-Process -FilePath 'python' `
    -ArgumentList @('-m', 'http.server', '8080') `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -PassThru
  $serverPid = $server.Id
  Set-Content -Path $pidFile -Value $serverPid -NoNewline
}

$url = 'http://127.0.0.1:8080/'
$deadline = (Get-Date).AddSeconds(10)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 300
  }
}

if (-not $ready) {
  throw "Game server did not become ready at $url"
}

Set-Content -Path $urlFile -Value $url -NoNewline

$chromePaths = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
)
$browserExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browserExe) {
  $browser = Start-Process -FilePath $browserExe -ArgumentList @('--new-window', $url) -PassThru
  Set-Content -Path $browserFile -Value $browser.Id -NoNewline
} else {
  Start-Process $url | Out-Null
}

Write-Output "Aircraft War Clone started: $url"
