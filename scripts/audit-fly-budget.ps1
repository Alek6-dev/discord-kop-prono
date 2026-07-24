param(
  [string]$App = "discord-kop-prono",
  [string]$DatabaseApp = "discord-kop-prono-db",
  [int]$ExpectedAppMachines = 1,
  [int]$ExpectedAppMemoryMb = 512,
  [int]$ExpectedDatabaseMachines = 1,
  [int]$ExpectedDatabaseMemoryMb = 256,
  [int]$ExpectedDatabaseVolumeGb = 1
)

$ErrorActionPreference = "Stop"

function Get-FlyPath {
  $flyCommand = Get-Command flyctl -ErrorAction SilentlyContinue
  if ($flyCommand) {
    return $flyCommand.Source
  }

  $profileFlyPath = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe"
  if (Test-Path -LiteralPath $profileFlyPath) {
    return $profileFlyPath
  }

  throw "flyctl was not found. Install it first with the official Fly.io installer."
}

function Invoke-FlyJson([string[]]$Arguments) {
  $flyPath = Get-FlyPath
  $json = & $flyPath @Arguments --json

  if ($LASTEXITCODE -ne 0) {
    throw "flyctl $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }

  return $json | ConvertFrom-Json
}

function Add-Issue([System.Collections.Generic.List[string]]$Issues, [string]$Message) {
  $Issues.Add($Message) | Out-Null
}

$issues = [System.Collections.Generic.List[string]]::new()

$appMachines = @(Invoke-FlyJson @("machines", "list", "--app", $App))
$databaseMachines = @(Invoke-FlyJson @("machines", "list", "--app", $DatabaseApp))
$databaseVolumes = @(Invoke-FlyJson @("volumes", "list", "--app", $DatabaseApp))

if ($appMachines.Count -ne $ExpectedAppMachines) {
  Add-Issue $issues "App machine count is $($appMachines.Count), expected $ExpectedAppMachines."
}

foreach ($machine in $appMachines) {
  $processGroup = $machine.config.env.FLY_PROCESS_GROUP
  $memoryMb = [int]$machine.config.guest.memory_mb
  $cpuKind = $machine.config.guest.cpu_kind
  $cpus = [int]$machine.config.guest.cpus

  if ($machine.state -ne "started") {
    Add-Issue $issues "App machine $($machine.id) state is $($machine.state), expected started."
  }

  if ($processGroup -ne "app") {
    Add-Issue $issues "App machine $($machine.id) process group is $processGroup, expected app."
  }

  if ($memoryMb -ne $ExpectedAppMemoryMb) {
    Add-Issue $issues "App machine $($machine.id) memory is ${memoryMb}MB, expected ${ExpectedAppMemoryMb}MB."
  }

  if ($cpuKind -ne "shared" -or $cpus -ne 1) {
    Add-Issue $issues "App machine $($machine.id) CPU is ${cpuKind}/${cpus}, expected shared/1."
  }
}

if ($databaseMachines.Count -ne $ExpectedDatabaseMachines) {
  Add-Issue $issues "Database machine count is $($databaseMachines.Count), expected $ExpectedDatabaseMachines."
}

foreach ($machine in $databaseMachines) {
  $memoryMb = [int]$machine.config.guest.memory_mb
  $cpuKind = $machine.config.guest.cpu_kind
  $cpus = [int]$machine.config.guest.cpus

  if ($machine.state -ne "started") {
    Add-Issue $issues "Database machine $($machine.id) state is $($machine.state), expected started."
  }

  if ($memoryMb -ne $ExpectedDatabaseMemoryMb) {
    Add-Issue $issues "Database machine $($machine.id) memory is ${memoryMb}MB, expected ${ExpectedDatabaseMemoryMb}MB."
  }

  if ($cpuKind -ne "shared" -or $cpus -ne 1) {
    Add-Issue $issues "Database machine $($machine.id) CPU is ${cpuKind}/${cpus}, expected shared/1."
  }
}

$totalVolumeGb = 0
foreach ($volume in $databaseVolumes) {
  $totalVolumeGb += [int]$volume.size_gb
}

if ($totalVolumeGb -ne $ExpectedDatabaseVolumeGb) {
  Add-Issue $issues "Database volume total is ${totalVolumeGb}GB, expected ${ExpectedDatabaseVolumeGb}GB."
}

Write-Output "Fly budget audit"
Write-Output "App machines: $($appMachines.Count), expected $ExpectedAppMachines"
Write-Output "Database machines: $($databaseMachines.Count), expected $ExpectedDatabaseMachines"
Write-Output "Database volume total: ${totalVolumeGb}GB, expected ${ExpectedDatabaseVolumeGb}GB"

if ($issues.Count -gt 0) {
  Write-Output ""
  Write-Output "Budget drift detected:"
  foreach ($issue in $issues) {
    Write-Output "- $issue"
  }
  exit 1
}

Write-Output "Budget shape OK."
