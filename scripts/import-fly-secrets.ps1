param(
  [string]$App = "discord-kop-prono",
  [string]$EnvPath = ".env"
)

$ErrorActionPreference = "Stop"

function Read-DotEnv([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing env file: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $normalizedLine = $line.TrimStart([char]0xFEFF)

    if ($normalizedLine -match "^\s*$" -or $normalizedLine -match "^\s*#") {
      continue
    }

    if ($normalizedLine -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $key = $Matches[1].TrimStart([char]0xFEFF)
      $value = $Matches[2].Trim()

      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }

      $values[$key] = $value
    }
  }

  return $values
}

function New-AdminToken {
  $bytes = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
}

$envValues = Read-DotEnv $EnvPath

if (-not $envValues.ContainsKey("ADMIN_TOKEN") -or [string]::IsNullOrWhiteSpace($envValues["ADMIN_TOKEN"])) {
  $adminToken = New-AdminToken
  Add-Content -LiteralPath $EnvPath -Value ""
  Add-Content -LiteralPath $EnvPath -Value "ADMIN_TOKEN=$adminToken"
  $envValues["ADMIN_TOKEN"] = $adminToken
  Write-Output "ADMIN_TOKEN generated and saved to $EnvPath."
}

$requiredKeys = @(
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "DISCORD_PRONOSTICS_CHANNEL_ID",
  "DISCORD_RESULTS_CHANNEL_ID",
  "DISCORD_ADMIN_CHANNEL_ID",
  "ADMIN_TOKEN"
)

$missingKeys = @()
foreach ($key in $requiredKeys) {
  if (-not $envValues.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envValues[$key])) {
    $missingKeys += $key
  }
}

if ($missingKeys.Count -gt 0) {
  throw "Missing required env values: $($missingKeys -join ', ')"
}

$flyCommand = Get-Command flyctl -ErrorAction SilentlyContinue
if ($flyCommand) {
  $flyPath = $flyCommand.Source
} else {
  $flyPath = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe"
}

if (-not (Test-Path -LiteralPath $flyPath)) {
  throw "flyctl was not found. Install it first with the official Fly.io installer."
}

$secretArgs = @()
foreach ($key in $requiredKeys) {
  $secretArgs += "$key=$($envValues[$key])"
}

& $flyPath secrets set --app $App --stage @secretArgs

if ($LASTEXITCODE -ne 0) {
  throw "flyctl secrets set failed with exit code $LASTEXITCODE"
}

Write-Output "Fly secrets staged for $App."
