$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot = $script:DataRoot
$taskExe = Join-Path $taskRoot 'runtime\ChatGPT.exe'
& (Join-Path $PSScriptRoot 'Stop-Copy.ps1')
$taskNode = $script:NodePath
& $taskNode (Join-Path $script:ProjectRoot 'tools\manage-patch.mjs') rollback
if ($LASTEXITCODE -ne 0) { throw 'Rollback failed. Backups were preserved.' }
$taskMetadataPath=Join-Path $taskRoot 'metadata.json'
$taskMetadata=Get-Content -LiteralPath $taskMetadataPath -Raw|ConvertFrom-Json
$taskBaseline=Get-Content -LiteralPath (Join-Path $taskRoot 'backup\baseline.json') -Raw|ConvertFrom-Json
$taskMetadata.verifiedArchiveHeaderHash=$taskBaseline.originalHeaderHash
$taskMetadata.status='independent-copy-original-animation-disabled'
[IO.File]::WriteAllText($taskMetadataPath,($taskMetadata|ConvertTo-Json -Depth 12))
Write-Output 'Original startup files restored in the independent copy. Store installation and profile data were not changed.'
