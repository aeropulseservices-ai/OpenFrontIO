# Removes the SkyFront shortcuts and its Settings > Apps entry. The game
# folder itself is left in place; delete it yourself if you want it gone.
. (Join-Path $PSScriptRoot "Common.ps1")

& (Join-Path $PSScriptRoot "Stop-SkyFront.ps1")
$desktop = [Environment]::GetFolderPath("Desktop")
Remove-Item (Join-Path $desktop "SkyFront.lnk") -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath("Programs")) "SkyFront") -Recurse -ErrorAction SilentlyContinue
Remove-Item "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SkyFront" -Recurse -ErrorAction SilentlyContinue
Remove-Item $SkyFrontData -Recurse -ErrorAction SilentlyContinue

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
  "SkyFront was uninstalled. The game files are still in:`n$SkyFrontRoot`nYou can delete that folder if you no longer need it.",
  "SkyFront") | Out-Null
