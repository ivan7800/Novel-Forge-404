@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js no esta instalado. La aplicacion no lo necesita para funcionar.
  echo Para ejecutar la verificacion automatica instala Node.js LTS.
  pause
  exit /b 1
)
call npm run verify
pause
