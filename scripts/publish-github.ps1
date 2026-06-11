# Crea el repo en GitHub y sube main (requiere: gh auth login)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Primero inicia sesion: gh auth login" -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
}

$repoName = if ($args[0]) { $args[0] } else { "trading-journal" }

Write-Host "Creando repo publico: $repoName ..."
gh repo create $repoName --public --source=. --remote=origin --push `
  --description "Trading journal desktop app with MetaTrader 5 sync"

Write-Host "`nListo. URL:" -ForegroundColor Green
gh repo view --web 2>$null
gh repo view --json url -q .url
