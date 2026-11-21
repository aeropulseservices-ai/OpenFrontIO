# Installs SkyFront on this PC: checks Node.js, installs the game's
# dependencies, and adds Desktop and Start menu shortcuts plus an entry in
# Settings > Apps so it can be uninstalled like any other program.
. (Join-Path $PSScriptRoot "Common.ps1")

Write-Host "Installing SkyFront from $SkyFrontRoot" -ForegroundColor Cyan

# 1. Node.js 24 or newer.
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeMajor = 0
if ($node) { $nodeMajor = [int]((& node -v).TrimStart("v").Split(".")[0]) }
if ($nodeMajor -lt 24) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Installing Node.js 24 with winget..."
    & winget install --id OpenJS.NodeJS --version 24 -e --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
      [Environment]::GetEnvironmentVariable("Path", "User")
  } else {
    Write-Host "SkyFront needs Node.js 24 or newer. Install it from https://nodejs.org and run this installer again." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
}

# 2. npm 12 or newer.
$npmMajor = [int]((& npm -v).Split(".")[0])
if ($npmMajor -lt 12) {
  Write-Host "Updating npm..."
  & npm install -g npm@12
}

# 3. Game dependencies.
Write-Host "Installing game files (this can take a few minutes)..."
Push-Location $SkyFrontRoot
try {
  & npm run inst
  if ($LASTEXITCODE -ne 0) { throw "npm run inst failed" }
} finally {
  Pop-Location
}

# 4. Shortcuts.
$icon = Join-Path $PSScriptRoot "SkyFront.ico"
$ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$shell = New-Object -ComObject WScript.Shell
function New-SkyFrontShortcut($path, $script, $description) {
  $lnk = $shell.CreateShortcut($path)
  $lnk.TargetPath = $ps
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $PSScriptRoot $script)`""
  $lnk.WorkingDirectory = $SkyFrontRoot
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = $description
  $lnk.Save()
}

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "SkyFront"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
New-SkyFrontShortcut (Join-Path $desktop "SkyFront.lnk") "Start-SkyFront.ps1" "Play SkyFront"
New-SkyFrontShortcut (Join-Path $startMenu "SkyFront.lnk") "Start-SkyFront.ps1" "Play SkyFront"
New-SkyFrontShortcut (Join-Path $startMenu "Stop SkyFront server.lnk") "Stop-SkyFront.ps1" "Stop the SkyFront game server"

# 5. Settings > Apps entry (current user only, no admin needed).
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SkyFront"
New-Item -Path $uninstallKey -Force | Out-Null
$uninstall = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'Uninstall-SkyFront.ps1')`""
Set-ItemProperty -Path $uninstallKey -Name DisplayName -Value "SkyFront"
Set-ItemProperty -Path $uninstallKey -Name DisplayIcon -Value $icon
Set-ItemProperty -Path $uninstallKey -Name Publisher -Value "SkyFront mod of OpenFront (OpenFront and Contributors)"
Set-ItemProperty -Path $uninstallKey -Name InstallLocation -Value $SkyFrontRoot
Set-ItemProperty -Path $uninstallKey -Name UninstallString -Value $uninstall
Set-ItemProperty -Path $uninstallKey -Name NoModify -Value 1 -Type DWord
Set-ItemProperty -Path $uninstallKey -Name NoRepair -Value 1 -Type DWord

Write-Host ""
Write-Host "SkyFront is installed. Double-click the SkyFront icon on your Desktop to play." -ForegroundColor Green
