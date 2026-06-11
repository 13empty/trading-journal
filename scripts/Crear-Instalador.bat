@echo off
title Trading Journal - Instalador
cd /d "%~dp0.."
call npm run pack:installer
echo.
echo Instalador: release\Trading-Journal-Setup-*.exe
pause
