param([string]$TargetRoot = '')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot = if ($TargetRoot) { [System.IO.Path]::GetFullPath($TargetRoot) } else { $script:DataRoot }
$taskExe = Join-Path $taskRoot 'runtime\ChatGPT.exe'
$taskState = Join-Path $taskRoot 'state'
$existing = Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq $taskExe -and $_.CommandLine -notmatch '--type=' }
if ($existing) { Write-Output 'Independent Codex copy is already running.'; exit 0 }
New-Item -ItemType Directory -Path $taskState -Force | Out-Null
$env:CODEX_HOME = Join-Path $taskState 'core'
$env:CODEX_ELECTRON_USER_DATA_PATH = Join-Path $taskState 'ui'
$taskLog = Join-Path $taskState 'chromium.log'
$taskArgs = @('--user-data-dir="' + $env:CODEX_ELECTRON_USER_DATA_PATH + '"', '--enable-logging', '--log-file="' + $taskLog + '"')
$taskStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$taskStartInfo.FileName = $taskExe
$taskStartInfo.WorkingDirectory = Split-Path $taskExe
$taskStartInfo.Arguments = $taskArgs -join ' '
$taskStartInfo.UseShellExecute = $false
$taskStartInfo.CreateNoWindow = $true
$taskProcess = [System.Diagnostics.Process]::Start($taskStartInfo)
[System.IO.File]::WriteAllText((Join-Path $taskState 'last-launch.json'), (@{ pid = $taskProcess.Id; executable = $taskExe; started = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json))
Write-Output ('Started independent Codex copy, PID ' + $taskProcess.Id)
