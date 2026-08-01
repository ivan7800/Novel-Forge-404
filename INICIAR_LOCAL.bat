@echo off
setlocal
cd /d "%~dp0"
set "PORT=8080"
set "HOST=127.0.0.1"

where py >nul 2>&1
if %errorlevel%==0 (
  start "Novel Forge 404 - servidor" /min py -m http.server %PORT% --bind %HOST%
  timeout /t 1 /nobreak >nul
  start "" http://%HOST%:%PORT%/
  echo Novel Forge 404 esta disponible en http://%HOST%:%PORT%/
  echo Cierra la ventana minimizada del servidor para detenerlo.
  exit /b 0
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "Novel Forge 404 - servidor" /min python -m http.server %PORT% --bind %HOST%
  timeout /t 1 /nobreak >nul
  start "" http://%HOST%:%PORT%/
  echo Novel Forge 404 esta disponible en http://%HOST%:%PORT%/
  echo Cierra la ventana minimizada del servidor para detenerlo.
  exit /b 0
)

echo No se ha encontrado Python.
echo Se abrira index.html directamente. La instalacion PWA y el modo offline no estaran disponibles.
start "" "%~dp0index.html"
pause
