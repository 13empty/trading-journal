@echo off

title Trading Journal (App)

cd /d "%~dp0"



where node >nul 2>&1 || (echo Instala Node.js desde https://nodejs.org & pause & exit /b 1)

where python >nul 2>&1 || (echo Instala Python para sync MT5 & pause & exit /b 1)



if not exist "dist\index.html" (

  echo Compilando interfaz...

  call npm run build

  if errorlevel 1 pause & exit /b 1

)



echo Abriendo aplicacion de escritorio...

call npm run app

