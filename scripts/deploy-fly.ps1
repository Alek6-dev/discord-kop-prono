param(
  [string]$App = "discord-kop-prono"
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

& $flyPath deploy --app $App --remote-only --yes --ha=false --vm-size shared-cpu-1x --vm-memory 512
if ($LASTEXITCODE -ne 0) {
  throw "flyctl deploy failed with exit code $LASTEXITCODE"
}

& $flyPath scale count 1 --app $App --process-group app --yes
if ($LASTEXITCODE -ne 0) {
  throw "flyctl scale count failed with exit code $LASTEXITCODE"
}

& $flyPath status --app $App
if ($LASTEXITCODE -ne 0) {
  throw "flyctl status failed with exit code $LASTEXITCODE"
}
