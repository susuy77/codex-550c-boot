param([switch]$CheckOnly, [switch]$ForceRebuild)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$taskRoot = $script:DataRoot
$taskWorkspace = $taskRoot
$taskNode = $script:NodePath
$pendingPath=Join-Path $taskRoot 'upgrade-state.json'
if (Test-Path -LiteralPath $pendingPath) {
  $pending=Get-Content -LiteralPath $pendingPath -Raw | ConvertFrom-Json
  if ($pending.status -eq 'prepared') { throw 'Previous upgrade was interrupted. Run Recover-Upgrade.cmd before retrying.' }
}
function Write-TaskJson($File, $Value) { [System.IO.File]::WriteAllText($File, ($Value | ConvertTo-Json -Depth 12)) }
function Assert-TaskPath($File, $Base) {
  $absolute = [System.IO.Path]::GetFullPath($File)
  $basePath = [System.IO.Path]::GetFullPath($Base).TrimEnd('\') + '\'
  if (-not $absolute.StartsWith($basePath, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path outside intended workspace.' }
}
function Copy-TaskDirectory($Source, $Destination) {
  robocopy $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw ('Directory copy failed: ' + $LASTEXITCODE) }
}
function Invoke-TaskNode($Arguments) {
  $taskResult = & $taskNode @Arguments
  if ($LASTEXITCODE -ne 0) { throw ('Compatibility operation failed: ' + ($taskResult -join ' ')) }
  return ($taskResult -join "`n")
}
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
& $taskNode (Join-Path $script:ProjectRoot 'tools\build-animation.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Animation build failed.' }
$package = Get-AppxPackage OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) { throw 'Installed official Codex package not found.' }
$sourceApp = Join-Path $package.InstallLocation 'app'
if ((Get-AuthenticodeSignature -LiteralPath (Join-Path $sourceApp 'ChatGPT.exe')).Status -ne 'Valid') { throw 'Official source executable signature is not valid.' }
try { $inspection = (Invoke-TaskNode @((Join-Path $script:ProjectRoot 'tools\inspect-compatibility.mjs'), $sourceApp)) | ConvertFrom-Json }
catch { Write-TaskJson (Join-Path $taskRoot 'upgrade-check.json') @{compatible=$false;installedPackage=$package.PackageFullName;reason=$_.Exception.Message}; throw }
$current = if (Test-Path -LiteralPath (Join-Path $taskRoot 'metadata.json')) { Get-Content -LiteralPath (Join-Path $taskRoot 'metadata.json') -Raw | ConvertFrom-Json } else { @{ package=$null;internalVersion=$null } }
$isSame = $current.package -eq $package.PackageFullName -and $current.internalVersion -eq $inspection.internalVersion
$check = @{ available = (-not $isSame); compatible = $true; currentPackage = $current.package; installedPackage = $package.PackageFullName; internalVersion = $inspection.internalVersion; checks = $inspection; scope = 'Installed official package only; no download or installation' }
Write-TaskJson (Join-Path $taskRoot 'upgrade-check.json') $check
if ($CheckOnly -or ($isSame -and -not $ForceRebuild)) { $check | ConvertTo-Json -Depth 10; exit 0 }
$generation = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$candidate = Join-Path $taskWorkspace ('staging\codex-upgrade-' + $generation)
$snapshot = Join-Path $taskRoot ('history\' + $generation)
Assert-TaskPath $candidate (Join-Path $taskWorkspace 'staging')
Assert-TaskPath $snapshot $taskRoot
$sourceBytes = (Get-ChildItem -LiteralPath $sourceApp -File -Recurse -Force | Measure-Object Length -Sum).Sum
$archiveBytes = (Get-Item -LiteralPath (Join-Path $sourceApp 'resources\app.asar')).Length
$profileBytes=0
if (Test-Path -LiteralPath (Join-Path $taskRoot 'state')) { $profileBytes=(Get-ChildItem -LiteralPath (Join-Path $taskRoot 'state') -File -Recurse -Force | Measure-Object Length -Sum).Sum }
$drive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($candidate).Substring(0,1))
if ($drive.Free -lt ($sourceBytes + 2 * $archiveBytes + $profileBytes + 512MB)) { throw 'Insufficient disk space to stage upgrade and preserve rollback.' }
New-Item -ItemType Directory -Path $candidate -Force | Out-Null
Write-Output 'Preparing candidate; current copy remains intact.'
Copy-TaskDirectory $sourceApp (Join-Path $candidate 'runtime')
$staged = Join-Path $candidate 'animation.asar'
Invoke-TaskNode @((Join-Path $script:ProjectRoot 'tools\build-local-asar.mjs'), (Join-Path $candidate 'runtime\resources\app.asar'), $staged) | Out-Null
$oldTarget = $env:CODEX_550C_TARGET_ROOT
$oldSource = $env:CODEX_550C_SOURCE_PACKAGE
try {
  $env:CODEX_550C_TARGET_ROOT = $candidate
  $env:CODEX_550C_SOURCE_PACKAGE = $package.PackageFullName
  Invoke-TaskNode @((Join-Path $script:ProjectRoot 'tools\manage-patch.mjs'), 'apply', $staged) | Out-Null
  $candidateVerify = (Invoke-TaskNode @((Join-Path $script:ProjectRoot 'tools\manage-patch.mjs'), 'verify')) | ConvertFrom-Json
} finally { $env:CODEX_550C_TARGET_ROOT = $oldTarget; $env:CODEX_550C_SOURCE_PACKAGE = $oldSource }
icacls (Join-Path $candidate 'runtime') /grant '*S-1-15-2-1:(OI)(CI)(RX)' '*S-1-15-2-2:(OI)(CI)(RX)' /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Candidate sandbox file permissions could not be set.' }
Write-Output 'Testing candidate in an independent temporary profile.'
& (Join-Path $PSScriptRoot 'Launch-Codex.ps1') -TargetRoot $candidate
$candidatePid = (Get-Content -LiteralPath (Join-Path $candidate 'state\last-launch.json') -Raw | ConvertFrom-Json).pid
$timer = [Diagnostics.Stopwatch]::StartNew()
$passed = $false
try {
  while ($timer.Elapsed.TotalSeconds -lt 40) {
    Start-Sleep -Milliseconds 500
    $log = Join-Path $candidate 'state\chromium.log'
    if (Test-Path -LiteralPath $log) {
      $lines = @(Get-Content -LiteralPath $log | Where-Object { $_ -match ('\[' + $candidatePid + ':') })
      if ($lines -match '550C boot animation (stopped|unavailable)|Refused to execute inline script|Sandbox cannot access executable') { throw 'Candidate startup compatibility failure.' }
      if (($lines -match 'CODEX_550C:START') -and ($lines -match 'CODEX_550C:END')) { $passed = $true; break }
    }
    if (-not (Get-Process -Id $candidatePid -ErrorAction SilentlyContinue)) { throw 'Candidate exited before startup completed.' }
  }
  if (-not $passed) { throw 'Candidate startup validation timed out; current version preserved.' }
} finally { & (Join-Path $PSScriptRoot 'Stop-Copy.ps1') -TargetRoot $candidate }
Remove-Item -LiteralPath $staged
$newMetadata = @{ package=$package.PackageFullName; internalVersion=$inspection.internalVersion; status='independent-copy-installed-animation-enabled'; verifiedArchiveHeaderHash=$candidateVerify.verifiedHeaderHash; rollbackTested=$false; upgradeGeneration=$generation; startupSmokeTest='passed'; source=$inspection }
Write-TaskJson (Join-Path $candidate 'metadata.json') $newMetadata
New-Item -ItemType Directory -Path $snapshot -Force | Out-Null
$journal = @{ status='prepared'; candidate=$candidate; previousSnapshot=$snapshot; targetPackage=$package.PackageFullName; previousPackage=$current.package }
Write-TaskJson (Join-Path $taskRoot 'upgrade-state.json') $journal
Write-Output 'Candidate passed. Switching independent copy and preserving previous version.'
& (Join-Path $PSScriptRoot 'Stop-Copy.ps1')
if (Test-Path -LiteralPath (Join-Path $taskRoot 'state')) { Copy-TaskDirectory (Join-Path $taskRoot 'state') (Join-Path $snapshot 'profile-before-upgrade') }
if (Test-Path -LiteralPath (Join-Path $taskRoot 'metadata.json')) { Copy-Item -LiteralPath (Join-Path $taskRoot 'metadata.json') -Destination (Join-Path $snapshot 'metadata.json') }
try {
  foreach ($name in @('runtime','backup')) {
    $old = Join-Path $taskRoot $name
    Assert-TaskPath $old $taskRoot
    if (Test-Path -LiteralPath $old) { Move-Item -LiteralPath $old -Destination (Join-Path $snapshot $name) }
    Move-Item -LiteralPath (Join-Path $candidate $name) -Destination $old
  }
  Copy-Item -LiteralPath (Join-Path $candidate 'metadata.json') -Destination (Join-Path $taskRoot 'metadata.json') -Force
  Invoke-TaskNode @((Join-Path $script:ProjectRoot 'tools\manage-patch.mjs'),'verify') | Out-Null
  $journal.status='complete'
  Write-TaskJson (Join-Path $taskRoot 'upgrade-state.json') $journal
 } catch {
  if (-not $current.package) {
    foreach ($name in @('runtime','backup','metadata.json')) {
      $active=Join-Path $taskRoot $name
      if (Test-Path -LiteralPath $active) { Move-Item -LiteralPath $active -Destination (Join-Path $snapshot ('incomplete-' + $name)) }
    }
    $journal.status='failed-first-install-preserved'
    Write-TaskJson (Join-Path $taskRoot 'upgrade-state.json') $journal
    throw
  }
  foreach ($name in @('runtime','backup')) {
    $previous = Join-Path $snapshot $name
    if (Test-Path -LiteralPath $previous) {
      $active = Join-Path $taskRoot $name
      if (Test-Path -LiteralPath $active) { Move-Item -LiteralPath $active -Destination (Join-Path $candidate ('failed-' + $name)) }
      Move-Item -LiteralPath $previous -Destination $active
    }
  }
  if (Test-Path -LiteralPath (Join-Path $snapshot 'metadata.json')) { Copy-Item -LiteralPath (Join-Path $snapshot 'metadata.json') -Destination (Join-Path $taskRoot 'metadata.json') -Force }
  $journal.status='failed-restored'
  Write-TaskJson (Join-Path $taskRoot 'upgrade-state.json') $journal
  throw
}
Write-Output ('Upgrade complete. Previous version preserved at ' + $snapshot)
Write-Output 'Launch using the same shortcut. Profile-before-upgrade is retained for data recovery.'
