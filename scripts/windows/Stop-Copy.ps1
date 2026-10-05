param([string]$TargetRoot = '')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$targetData = if ($TargetRoot) { [IO.Path]::GetFullPath($TargetRoot) } else { $script:DataRoot }
$taskExe = Join-Path $targetData 'runtime\ChatGPT.exe'
$shutdownTimer=[Diagnostics.Stopwatch]::StartNew()
do {
  $copyProcesses = @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq $taskExe })
  if ($copyProcesses.Count -eq 0) { break }
  foreach ($copyProcess in $copyProcesses) { Stop-Process -Id $copyProcess.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 600
} while ($shutdownTimer.Elapsed.TotalSeconds -lt 15)
if (@(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq $taskExe }).Count -gt 0) { throw 'Independent copy is still running; files were not modified.' }
Start-Sleep -Milliseconds 300
