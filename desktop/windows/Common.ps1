# Shared paths and helpers for the SkyFront Windows launcher scripts.
$ErrorActionPreference = "Stop"
$SkyFrontRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$SkyFrontData = Join-Path $env:LOCALAPPDATA "SkyFront"
$SkyFrontUrl = "http://localhost:9000"
$SkyFrontPidFile = Join-Path $SkyFrontData "server.pid"
$SkyFrontLog = Join-Path $SkyFrontData "server.log"
New-Item -ItemType Directory -Force -Path $SkyFrontData | Out-Null

function Test-SkyFrontRunning {
  try {
    Invoke-WebRequest -Uri $SkyFrontUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Find-AppBrowser {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}
