$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot = $script:DataRoot
& (Join-Path $PSScriptRoot 'Stop-Copy.ps1')
$taskNode = $script:NodePath
& $taskNode (Join-Path $script:ProjectRoot 'tools\build-animation.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Animation build failed.' }
$taskWorkspace = $taskRoot
$taskWork = Join-Path $taskWorkspace 'staging'
New-Item -ItemType Directory -Path $taskWork -Force | Out-Null
$taskStaged = Join-Path $taskWork ('codex-550c-' + [Guid]::NewGuid().ToString('N') + '.asar')
& $taskNode (Join-Path $script:ProjectRoot 'tools\build-local-asar.mjs') (Join-Path $taskRoot 'backup\app.asar.original') $taskStaged
if ($LASTEXITCODE -ne 0) { throw 'Failed to build animation archive; backups preserved.' }
& $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') apply $taskStaged
if ($LASTEXITCODE -ne 0) { throw 'Failed to enable animation; backups preserved.' }
Remove-Item -LiteralPath $taskStaged
$taskVerification=& $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') verify
if ($LASTEXITCODE -ne 0) { throw 'Enabled animation failed final validation.' }
$taskMetadataPath=Join-Path $taskRoot 'metadata.json'
$taskMetadata=Get-Content -LiteralPath $taskMetadataPath -Raw|ConvertFrom-Json
$taskMetadata.verifiedArchiveHeaderHash=($taskVerification -join "`n"|ConvertFrom-Json).verifiedHeaderHash
$taskMetadata.status='independent-copy-installed-animation-enabled'
[IO.File]::WriteAllText($taskMetadataPath,($taskMetadata|ConvertTo-Json -Depth 12))
Write-Output '550C animation enabled in the independent copy. Use the launch shortcut to open it.'
