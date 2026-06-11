# Crea un acceso directo en Inicio de Windows para abrir el journal al encender el PC
$projectRoot = Split-Path $PSScriptRoot -Parent
$batPath = Join-Path $projectRoot "Iniciar-Trading-Journal.bat"
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "Trading Journal.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $batPath
$sc.WorkingDirectory = $projectRoot
$sc.Description = "Trading Journal — puente, MT5 sync y app web"
$sc.Save()

Write-Host ""
Write-Host "Listo. Al iniciar Windows se abrira Trading Journal." -ForegroundColor Green
Write-Host "Acceso directo: $shortcutPath"
Write-Host ""
Write-Host "Para quitarlo: Win+R -> shell:startup -> borra 'Trading Journal.lnk'"
Write-Host ""
Write-Host "Consejo: abre MT5 despues de iniciar sesion (o pon MT5 tambien en Inicio)."
Write-Host "Doble clic manual: $batPath"
