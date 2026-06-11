@echo off

title Crear Trading Journal.exe

cd /d "%~dp0"



where node >nul 2>&1 || (echo Instala Node.js: https://nodejs.org & pause & exit /b 1)

where python >nul 2>&1 || (echo Instala Python: https://python.org & pause & exit /b 1)



echo.

echo  Esto crea UN solo archivo .exe en la carpeta release\

echo  (puede tardar varios minutos la primera vez)

echo.



if not exist "node_modules\electron" (

  echo Instalando dependencias...

  call npm install

)



powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-ejecutable.ps1"
if errorlevel 1 (
  echo.
  echo  ERROR. Si fallo Python, prueba:
  echo    pip install pyinstaller MetaTrader5 requests
  echo    powershell -File scripts\build-mt5-sync.ps1
  echo.
  pause
  exit /b 1
)

echo.
echo  Listo. Busca release\Trading-Journal.exe
echo.
pause

