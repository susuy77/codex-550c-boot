param([switch]$RestoreProfile)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot=$script:DataRoot
$journalPath=Join-Path $taskRoot 'upgrade-state.json'
if (-not (Test-Path -LiteralPath $journalPath)) { throw 'No previous upgrade snapshot is available.' }
$journal=Get-Content -LiteralPath $journalPath -Raw | ConvertFrom-Json
if (-not $journal.previousPackage) { throw 'No previous application version is available after the first installation.' }
if ($journal.status -ne 'complete') { throw 'Last upgrade did not complete; inspect upgrade-state.json before recovery.' }
$previous=[IO.Path]::GetFullPath($journal.previousSnapshot)
$historyRoot=[IO.Path]::GetFullPath((Join-Path $taskRoot 'history')).TrimEnd('\')+'\'
if (-not $previous.StartsWith($historyRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid snapshot path.' }
foreach ($name in @('runtime','backup','metadata.json')) { if (-not (Test-Path -LiteralPath (Join-Path $previous $name))) { throw ('Incomplete previous snapshot: '+$name) } }
$taskNode = $script:NodePath
$oldTarget=$env:CODEX_550C_TARGET_ROOT
try {
  $env:CODEX_550C_TARGET_ROOT=$previous
  & $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') verify
  if ($LASTEXITCODE -ne 0) { throw 'Previous snapshot executable/archive pair failed verification.' }
} finally {$env:CODEX_550C_TARGET_ROOT=$oldTarget}
if ($RestoreProfile -and -not (Test-Path -LiteralPath (Join-Path $previous 'profile-before-upgrade'))) { throw 'No profile snapshot to restore.' }
& (Join-Path $PSScriptRoot 'Stop-Copy.ps1')
$saved=Join-Path $taskRoot ('history\rollback-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $saved -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'metadata.json') -Destination (Join-Path $saved 'metadata.json')
$moved=@()
try {
  foreach ($name in @('runtime','backup')) {
    Move-Item -LiteralPath (Join-Path $taskRoot $name) -Destination (Join-Path $saved $name)
    $moved += $name
    Move-Item -LiteralPath (Join-Path $previous $name) -Destination (Join-Path $taskRoot $name)
  }
  if ($RestoreProfile) {
    Move-Item -LiteralPath (Join-Path $taskRoot 'state') -Destination (Join-Path $saved 'profile-before-upgrade')
    $moved += 'state'
    Move-Item -LiteralPath (Join-Path $previous 'profile-before-upgrade') -Destination (Join-Path $taskRoot 'state')
  }
  Copy-Item -LiteralPath (Join-Path $previous 'metadata.json') -Destination (Join-Path $taskRoot 'metadata.json') -Force
  & $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') verify
  if ($LASTEXITCODE -ne 0) { throw 'Restored runtime validation failed.' }
  $journal.previousSnapshot=$saved
  $journal.status='complete'
  [IO.File]::WriteAllText($journalPath,($journal|ConvertTo-Json -Depth 10))
} catch {
  foreach ($name in $moved) {
    $active=Join-Path $taskRoot $name
    $saveName=if ($name -eq 'state') {'profile-before-upgrade'} else {$name}
    $priorName=if ($name -eq 'state') {'profile-before-upgrade'} else {$name}
    if (Test-Path -LiteralPath $active) { Move-Item -LiteralPath $active -Destination (Join-Path $previous $priorName) }
    Move-Item -LiteralPath (Join-Path $saved $saveName) -Destination $active
  }
  Copy-Item -LiteralPath (Join-Path $saved 'metadata.json') -Destination (Join-Path $taskRoot 'metadata.json') -Force
  throw
}
Write-Output 'Previous application version restored. Current version was preserved as another snapshot.'
if (-not $RestoreProfile) { Write-Output 'Current profile retained. If a version migration prevents startup, use the saved profile-before-upgrade snapshot.' }
