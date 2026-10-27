$ErrorActionPreference = 'Stop'

$containerName = if ($env:TOPSET_SUPABASE_DB_CONTAINER) { $env:TOPSET_SUPABASE_DB_CONTAINER } else { 'supabase_db_topset' }
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$testSqlPath = Join-Path $repositoryRoot 'supabase\tests\database\roles.test.sql'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error 'Docker CLI was not found. Start Docker Desktop and install Docker CLI.'
  exit 1
}

$containerState = & docker inspect --format '{{.State.Running}}' $containerName 2>$null
if ($LASTEXITCODE -ne 0 -or $containerState -ne 'true') {
  Write-Error "Supabase database container '$containerName' is not running. Start the local stack with 'npx supabase start'."
  exit 1
}

if (-not (Test-Path -LiteralPath $testSqlPath)) {
  Write-Error "Database test file was not found: $testSqlPath"
  exit 1
}

$psqlOutput = Get-Content -Raw -LiteralPath $testSqlPath | & docker exec -i $containerName psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres 2>&1
$psqlExitCode = $LASTEXITCODE
$outputText = $psqlOutput | Out-String
Write-Output $outputText

if ($psqlExitCode -ne 0) {
  Write-Error "psql failed with exit code $psqlExitCode."
  exit $psqlExitCode
}

$planMatch = [regex]::Match($outputText, '(?m)^\s*1\.\.(\d+)\s*$')
$plannedTests = if ($planMatch.Success) { [int]$planMatch.Groups[1].Value } else { 0 }
$passedTests = [regex]::Matches($outputText, '(?m)^\s*ok\s+\d+\s+-').Count
$failedTests = [regex]::Matches($outputText, '(?m)^\s*not ok\b').Count

if ($plannedTests -eq 0 -or $passedTests -ne $plannedTests -or $failedTests -gt 0) {
  Write-Error "pgTAP did not pass: planned $plannedTests, passed $passedTests, failed $failedTests."
  exit 1
}

Write-Output "pgTAP passed: $passedTests/$plannedTests assertions."
