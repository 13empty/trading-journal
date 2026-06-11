@echo off

chcp 65001 >nul

cd /d "%~dp0.."

echo Resync MT5 completo (app puede estar cerrada)...

set TJ_MT5_SERVER_OFFSET_HOURS=6

set TJ_BRIDGE_DIR=%APPDATA%\trading-journal\bridge-data

py -3 bridge-python\offline_resync.py

if errorlevel 1 (

  echo.

  echo ERROR: revisa que MT5 este abierto con sesion iniciada.

  pause

  exit /b 1

)

echo.

echo Listo. Abre Trading Journal y pulsa Sincronizar ahora (o espera unos segundos).

pause

