$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot=$script:DataRoot
$journalPath=Join-Path $taskRoot 'upgrade-state.json'
$journal=Get-Content -LiteralPath $journalPath -Raw|ConvertFrom-Json
if ($journal.status -ne 'prepared') { Write-Output 'No interrupted upgrade requires recovery.'; exit 0 }
$snapshot=[IO.Path]::GetFullPath($journal.previousSnapshot)
$history=[IO.Path]::GetFullPath((Join-Path $taskRoot 'history')).TrimEnd('\')+'\'
if (-not $snapshot.StartsWith($history,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid recovery snapshot path.' }
$recovery=Join-Path $taskRoot ('history\interrupted-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $recovery -Force|Out-Null
& (Join-Path $PSScriptRoot 'Stop-Copy.ps1')
if (-not $journal.previousPackage -and -not (Test-Path -LiteralPath (Join-Path $snapshot 'runtime'))) {
  foreach ($name in @('runtime','backup','metadata.json')) {
    $active=Join-Path $taskRoot $name
    if (Test-Path -LiteralPath $active) { Move-Item -LiteralPath $active -Destination (Join-Path $recovery $name) }
  }
  $journal.status='failed-first-install-preserved'
  [IO.File]::WriteAllText($journalPath,($journal|ConvertTo-Json -Depth 10))
  Write-Output 'Incomplete first installation preserved in history. Run Install.cmd again.'
  exit 0
}
foreach ($name in @('runtime','backup')) {
  $saved=Join-Path $snapshot $name
  if (Test-Path -LiteralPath $saved) {
    $active=Join-Path $taskRoot $name
    if (Test-Path -LiteralPath $active) { Move-Item -LiteralPath $active -Destination (Join-Path $recovery $name) }
    Move-Item -LiteralPath $saved -Destination $active
  }
}
if (Test-Path -LiteralPath (Join-Path $snapshot 'metadata.json')) { Copy-Item -LiteralPath (Join-Path $snapshot 'metadata.json') -Destination (Join-Path $taskRoot 'metadata.json') -Force }
$taskNode = $script:NodePath
& $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') verify
if ($LASTEXITCODE -ne 0) { throw 'Recovery is incomplete; all snapshots were retained.' }
$journal.status='failed-restored'
[IO.File]::WriteAllText($journalPath,($journal|ConvertTo-Json -Depth 10))
Write-Output 'Interrupted upgrade restored to the previous runtime. Current profile was preserved.'
