# Genera UN solo .exe portable: Trading Journal (app + puente + sync MT5)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Stop-BlockingAppProcesses {
  $stopped = $false

  foreach ($proc in Get-Process -ErrorAction SilentlyContinue) {
    $name = $proc.ProcessName
    $shouldStop = $false

    if ($name -eq 'Trading-Journal') {
      $shouldStop = $true
    } elseif ($name -eq 'electron') {
      try {
        $exePath = $proc.Path
        if ($exePath -and ($exePath -match 'trading-journal|Trading-Journal|release\\win-unpacked')) {
          $shouldStop = $true
        }
      } catch {
        # Path not available for some processes — skip
      }
    }

    if ($shouldStop) {
      Write-Host "Cerrando proceso en uso: $name (PID $($proc.Id))"
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      $stopped = $true
    }
  }

  if ($stopped) {
    Start-Sleep -Seconds 2
  }
}

function Get-PackOutputDir {
  param([Parameter(Mandatory)][string]$ReleaseDir)

  $staging = Join-Path $ReleaseDir 'pack-staging'
  if (Test-Path -LiteralPath $staging) {
    try {
      Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction Stop
    } catch {
      $staging = Join-Path $ReleaseDir ("pack-" + (Get-Date -Format 'yyyyMMddHHmmss'))
      Write-Host "pack-staging en uso; usando carpeta alternativa: $staging" -ForegroundColor Yellow
    }
  }
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  return $staging
}

function Clear-ElectronBuildOutput {
  param([Parameter(Mandatory)][string]$ReleaseDir)

  Stop-BlockingAppProcesses

  $portable = Join-Path $ReleaseDir 'Trading-Journal.exe'
  if (Test-Path -LiteralPath $portable) {
    try {
      Remove-Item -LiteralPath $portable -Force -ErrorAction Stop
      Write-Host "Eliminado: $portable"
    } catch {
      Write-Host "AVISO: no se pudo borrar $portable (se sobrescribira al final)." -ForegroundColor Yellow
    }
  }
}

function Invoke-ElectronPack {
  param([Parameter(Mandatory)][string]$OutputDir)

  $cmd = "npx electron-builder --win portable --config electron-builder.yml --config.directories.output=$OutputDir"
  Write-Host "> $cmd"
  & npx electron-builder --win portable --config electron-builder.yml "--config.directories.output=$OutputDir"
  if ($LASTEXITCODE -ne 0) {
    throw "electron-builder fallo (codigo $LASTEXITCODE)"
  }
}

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
$releaseDir = Join-Path $root "release"
Clear-ElectronBuildOutput -ReleaseDir $releaseDir
$packOut = Get-PackOutputDir -ReleaseDir $releaseDir
Write-Host "Salida temporal del empaquetado: $packOut"
Invoke-ElectronPack -OutputDir $packOut

$builtPortable = Join-Path $packOut "Trading-Journal.exe"
$finalPortable = Join-Path $releaseDir "Trading-Journal.exe"
if (-not (Test-Path -LiteralPath $builtPortable)) {
  throw "No se genero Trading-Journal.exe en $packOut"
}
Copy-Item -LiteralPath $builtPortable -Destination $finalPortable -Force
Write-Host "Copiado a: $finalPortable"

# Limpia salidas temporales viejas (deja solo el .exe final)
Get-ChildItem -LiteralPath $releaseDir -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'pack-*' -or $_.Name -eq 'win-unpacked' } |
  ForEach-Object {
    try {
      Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop
      Write-Host "Limpieza: $($_.Name)" -ForegroundColor DarkGray
    } catch {
      Write-Host "No se pudo borrar $($_.Name) (en uso)" -ForegroundColor Yellow
    }
  }

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
