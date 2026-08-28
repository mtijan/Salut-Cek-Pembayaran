$ErrorActionPreference = 'Stop'

$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH -and (Test-Path -LiteralPath $chromePath)) {
  $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = $chromePath
}

& node (Join-Path $PSScriptRoot 'run-browser-tests.mjs')
exit $LASTEXITCODE
