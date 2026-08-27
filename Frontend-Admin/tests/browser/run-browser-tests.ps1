$ErrorActionPreference = 'Stop'

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectRoot = (Resolve-Path (Join-Path $frontendRoot '..')).Path
$runtimeRoot = Join-Path $frontendRoot 'test-results\runtime'
$databasePath = Join-Path $runtimeRoot 'synthetic-browser.sqlite'
$importPath = Join-Path $runtimeRoot 'imports'
$serverProcess = $null
$testExitCode = 1

New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $importPath -Force | Out-Null

$env:APP_ENV = 'development'
$env:DATABASE_URL = $databasePath
$env:IMPORT_DIR = $importPath
$env:WEB_CONCURRENCY = '1'
$env:ADMIN_BOOTSTRAP_EMAIL = 'browser-admin@synthetic.test'
$env:ADMIN_BOOTSTRAP_PASSWORD = 'Synthetic-Browser-Only-2026!'
$env:LOOKUP_HASH_SECRET = 'synthetic-browser-secret-not-for-production'
$env:PORT = '8765'

try {
  $serverProcess = Start-Process -FilePath 'python' `
    -ArgumentList @('-m', 'uvicorn', 'Backend.app.main:app', '--host', '127.0.0.1', '--port', '8765') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
    if ($serverProcess.HasExited) {
      throw "Server browser sintetis berhenti sebelum siap (exit $($serverProcess.ExitCode))."
    }
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/api/health' -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) {
    throw 'Server browser sintetis tidak siap dalam 15 detik.'
  }

  & npx.cmd playwright test
  $testExitCode = $LASTEXITCODE
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
    [void]$serverProcess.WaitForExit(5000)
  }
}

exit $testExitCode
