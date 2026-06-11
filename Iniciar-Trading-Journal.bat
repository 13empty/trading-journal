@echo off

title Trading Journal

cd /d "%~dp0"



chcp 65001 >nul 2>&1

set PYTHONIOENCODING=utf-8

set PYTHONUTF8=1

set PYTHONUNBUFFERED=1



where node >nul 2>&1 || (echo Instala Node.js desde https://nodejs.org & pause & exit /b 1)

where python >nul 2>&1 || (echo Instala Python desde https://python.org & pause & exit /b 1)



echo.

echo  Trading Journal - iniciando puente + sync MT5 + app web

echo  Deja esta ventana abierta. Cierrala para detener todo.

echo  En la ventana debe aparecer [mt5] Cuenta XXXXX - si no, MT5 no conecto.

echo.



timeout /t 2 /nobreak >nul

start "" "http://localhost:5173"

npm run start

if errorlevel 1 (

  echo.

  echo  Algo fallo. Revisa los mensajes de [mt5] arriba.

  pause

)

