@echo off

title Sync MT5 -> Trading Journal

cd /d "%~dp0.."



where python >nul 2>&1 || (echo Instala Python & pause & exit /b 1)



echo Si el journal esta abierto, el puente ya corre en el puerto 3847.

echo Sincronizando con MetaTrader 5...

echo.



python -u -X utf8 bridge-python\mt5_sync.py

