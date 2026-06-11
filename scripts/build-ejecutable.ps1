# Genera UN solo .exe portable: Trading Journal (app + puente + sync MT5)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Invoke-Npm {
  param([Parameter(Mandatory)][string[]]$NpmArgs)

  $cmd = "npm $($NpmArgs -join ' ')"
  Write-Host "> $cmd"

  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & npm @NpmArgs 2>&1 | ForEach-Object { Write-Host $_ }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prevEap

  if ($code -ne 0) {
    throw "npm fallo (codigo $code): $cmd"
  }
}

Write-Host "=== 1/3 Compilando interfaz ==="
Invoke-Npm -NpmArgs @("run", "build")

Write-Host "`n=== 2/3 Compilando sync MT5 (mt5-sync.exe) ==="
& (Join-Path $root "scripts\build-mt5-sync.ps1")

$mt5Exe = Join-Path $root "build\mt5-sync.exe"
if (-not (Test-Path $mt5Exe)) {
  throw "Falta build\mt5-sync.exe. Revisa errores de Python arriba."
}

$bridgeState = Join-Path $root "bridge\bridge-state.json"
if (Test-Path $bridgeState) {
  Write-Host "`nAVISO: bridge\bridge-state.json existe (datos locales). No se incluye en el .exe." -ForegroundColor Yellow
}

Write-Host "`n=== 3/3 Empaquetando aplicacion portable (5-15 min) ==="
Invoke-Npm -NpmArgs @("run", "pack:portable")

Write-Host "`n=== LISTO ==="
$release = Join-Path $root "release"
$portable = Join-Path $release "Trading-Journal.exe"
if (Test-Path $portable) {
  $mb = [math]::Round((Get-Item $portable).Length / 1MB, 1)
  Write-Host "Ejecutable: $portable"
  Write-Host "Tamano: $mb MB"
} else {
  Get-ChildItem $release -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Ejecutable: $($_.FullName)"
  }
}

Write-Host "`nCopia Trading-Journal.exe al escritorio. Doble clic = abre todo (MT5 abierto)."
