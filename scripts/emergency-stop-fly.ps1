param(
  [string]$App = "discord-kop-prono",
  [string]$DatabaseApp = "discord-kop-prono-db"
)

$ErrorActionPreference = "Stop"

$flyCommand = Get-Command flyctl -ErrorAction SilentlyContinue
if ($flyCommand) {
  $flyPath = $flyCommand.Source
} else {
  $flyPath = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe"
}

if (-not (Test-Path -LiteralPath $flyPath)) {
  throw "flyctl was not found. Install it first with the official Fly.io installer."
}

Write-Output "Scaling $App app process to 0..."
& $flyPath scale count 0 --app $App --process-group app --yes
if ($LASTEXITCODE -ne 0) {
  throw "flyctl scale count failed with exit code $LASTEXITCODE"
}

Write-Output "Stopping Postgres machines for $DatabaseApp..."
$machineLines = & $flyPath machines list --app $DatabaseApp --json
if ($LASTEXITCODE -ne 0) {
  throw "flyctl machines list failed with exit code $LASTEXITCODE"
}

$machines = $machineLines | ConvertFrom-Json
foreach ($machine in $machines) {
  & $flyPath machine stop $machine.id --app $DatabaseApp
  if ($LASTEXITCODE -ne 0) {
    throw "flyctl machine stop failed for $($machine.id) with exit code $LASTEXITCODE"
  }
}

Write-Output "Emergency stop completed."
