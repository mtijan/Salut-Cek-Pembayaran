[CmdletBinding()]
param(
    [string]$VenvPath = ".venv-audit"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$requirementsPath = Join-Path $repositoryRoot "requirements-audit.txt"
$auditTargetPath = Join-Path $repositoryRoot "requirements.txt"
$venvDirectory = Join-Path $repositoryRoot $VenvPath
$venvPython = Join-Path $venvDirectory "Scripts\python.exe"

function Invoke-PythonChecked {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & $venvPython @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed with exit code ${LASTEXITCODE}: python $($Arguments -join ' ')"
    }
}

if (-not (Test-Path -LiteralPath $venvPython)) {
    python -m venv $venvDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create isolated virtual environment at $venvDirectory"
    }
}

Invoke-PythonChecked -Arguments @("-m", "pip", "install", "--upgrade", "-r", $requirementsPath)
Invoke-PythonChecked -Arguments @("-m", "pip", "check")
Invoke-PythonChecked -Arguments @("-m", "pip_audit", "-r", $auditTargetPath, "--progress-spinner", "off")

Write-Host "Python dependency integrity and CVE audit passed in $venvDirectory"
