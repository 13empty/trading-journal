# Copia el EA a MetaTrader 5 (solo 1 archivo)
$src = Join-Path $PSScriptRoot "mt5\TradingJournalBridge.mq5"
if (-not (Test-Path $src)) {
  Write-Host "Error: no se encuentra $src" -ForegroundColor Red
  exit 1
}

$terminals = Get-ChildItem "$env:APPDATA\MetaQuotes\Terminal" -Directory -ErrorAction SilentlyContinue
if (-not $terminals) {
  Write-Host "No se encontro carpeta MetaTrader 5." -ForegroundColor Red
  exit 1
}

foreach ($t in $terminals) {
  $destDir = Join-Path $t.FullName "MQL5\Experts\TradingJournalBridge"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Copy-Item $src (Join-Path $destDir "TradingJournalBridge.mq5") -Force
  Write-Host "Copiado a: $destDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "SIGUIENTE (obligatorio en MT5):" -ForegroundColor Yellow
Write-Host "1. Abre MetaEditor (F4 en MT5)"
Write-Host "2. Navegador -> Experts -> TradingJournalBridge -> TradingJournalBridge.mq5"
Write-Host "3. Pulsa F7 (Compilar) — debe decir '0 errors'"
Write-Host "4. Vuelve a MT5, en Navegador -> Asesores Expertos -> TradingJournalBridge"
Write-Host "5. Arrastra TradingJournalBridge a un grafico"
Write-Host ""
Write-Host "NO copies la carpeta bridge/ ni todo trading-journal — solo este .mq5"
