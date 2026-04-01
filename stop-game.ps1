$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$localDir = Join-Path $projectRoot '.local'
$pidFile = Join-Path $localDir 'game-server.pid'
$browserFile = Join-Path $localDir 'game-browser.txt'

if (Test-Path $browserFile) {
  $browserPid = (Get-Content $browserFile -Raw).Trim()
  if ($browserPid) {
    Stop-Process -Id ([int]$browserPid) -Force
    Write-Output "Closed game browser PID $browserPid"
  }
  Remove-Item $browserFile -Force -ErrorAction SilentlyContinue
}

if (Test-Path $pidFile) {
  $serverPid = (Get-Content $pidFile -Raw).Trim()
  if ($serverPid) {
    Stop-Process -Id ([int]$serverPid) -Force
    Write-Output "Stopped game server PID $serverPid"
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Get-CimInstance Win32_Process | Where-Object {
  $_.Name -match '^(python|python3)(\.exe)?$' -and $_.CommandLine -match 'http\.server 8080' -and $_.CommandLine -match [regex]::Escape($projectRoot)
} | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
  Write-Output "Stopped stray server PID $($_.ProcessId)"
}

Write-Output 'Aircraft War Clone stopped.'
