@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (echo ERROR: instala Python 3 desde python.org&pause&exit /b 1)
echo Instalando herramientas de prueba en tu Windows (solo si faltan)...
py -m pip install playwright || (pause & exit /b 1)
py -m playwright install chromium || (pause & exit /b 1)
py tests\browser_smoke.py
set RC=%errorlevel%
echo.
echo Informe: QA-BROWSER-RESULTS.json
pause
exit /b %RC%
