# Compila mt5_sync.py en mt5-sync.exe (incluye numpy para MetaTrader5)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Get-PythonCmd {
  if ($env:TJ_PYTHON -and (Get-Command $env:TJ_PYTHON -ErrorAction SilentlyContinue)) {
    return $env:TJ_PYTHON
  }
  foreach ($cmd in @("python", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) { return $cmd }
  }
  throw "Python no encontrado"
}

function Invoke-Python {
  param([string[]]$PyArgs)
  $py = Get-PythonCmd
  $allArgs = if ($py -eq "py") { @("-3") + $PyArgs } else { $PyArgs }
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $py @allArgs 2>&1 | ForEach-Object { Write-Host $_ }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  if ($code -ne 0) { throw "Fallo: $py $($allArgs -join ' ')" }
}

$outDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Instalando dependencias..."
Invoke-Python @("-m", "pip", "install", "--upgrade", "pip")
Invoke-Python @("-m", "pip", "install", "pyinstaller", "MetaTrader5", "requests", "numpy")

Write-Host "Compilando mt5-sync.exe (con numpy)..."
$scriptPath = Join-Path $root "bridge-python\mt5_sync.py"
Invoke-Python @(
  "-m", "PyInstaller",
  "--noconfirm",
  "--onefile",
  "--name", "mt5-sync",
  "--distpath", $outDir,
  "--workpath", (Join-Path $outDir "pyinstaller-work"),
  "--specpath", (Join-Path $outDir "pyinstaller-spec"),
  "--hidden-import", "MetaTrader5",
  "--hidden-import", "numpy",
  "--hidden-import", "numpy._core._multiarray_umath",
  "--collect-all", "numpy",
  "--collect-all", "MetaTrader5",
  "--console",
  $scriptPath
)

$exe = Join-Path $outDir "mt5-sync.exe"
if (-not (Test-Path $exe)) { throw "No se genero mt5-sync.exe" }
Write-Host "OK: $exe ($([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB)"
