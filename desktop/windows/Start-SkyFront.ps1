# Starts the SkyFront game server (if it isn't already running) and opens
# the game in its own app window.
. (Join-Path $PSScriptRoot "Common.ps1")

if (-not (Test-SkyFrontRunning)) {
  $proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "set SKIP_BROWSER_OPEN=true&& npm run dev > `"$SkyFrontLog`" 2>&1" `
    -WorkingDirectory $SkyFrontRoot -WindowStyle Hidden -PassThru
  Set-Content -Path $SkyFrontPidFile -Value $proc.Id

  # Wait up to 3 minutes for the first start (later starts are much faster).
  $deadline = (Get-Date).AddMinutes(3)
  while (-not (Test-SkyFrontRunning)) {
    if ((Get-Date) -gt $deadline -or $proc.HasExited) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show(
        "SkyFront didn't start. See the log at:`n$SkyFrontLog",
        "SkyFront") | Out-Null
      exit 1
    }
    Start-Sleep -Seconds 2
  }
}

$browser = Find-AppBrowser
if ($browser) {
  Start-Process -FilePath $browser -ArgumentList "--app=$SkyFrontUrl"
} else {
  Start-Process $SkyFrontUrl
}
