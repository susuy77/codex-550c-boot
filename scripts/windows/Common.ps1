$script:ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$script:DataRoot = if ($env:CODEX_550C_DATA_DIR) { [IO.Path]::GetFullPath($env:CODEX_550C_DATA_DIR) } else { Join-Path $script:ProjectRoot '.local' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js 22+ is required on PATH. Install Node.js from https://nodejs.org and reopen your terminal.' }
$script:NodePath = $nodeCommand.Source
$nodeVersion = & $script:NodePath --version
if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22 or later is required.' }
$env:CODEX_550C_TARGET_ROOT = $script:DataRoot
