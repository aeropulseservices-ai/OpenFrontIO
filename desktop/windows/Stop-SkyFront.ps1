# Stops the SkyFront game server started by Start-SkyFront.ps1.
. (Join-Path $PSScriptRoot "Common.ps1")

if (Test-Path $SkyFrontPidFile) {
  $serverPid = (Get-Content $SkyFrontPidFile | Select-Object -First 1).Trim()
  if ($serverPid) {
    & cmd.exe /c "taskkill /PID $serverPid /T /F >nul 2>&1"
  }
  Remove-Item $SkyFrontPidFile -ErrorAction SilentlyContinue
}
