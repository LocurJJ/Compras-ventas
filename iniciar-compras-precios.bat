@echo off
cd /d "%~dp0"
echo Compras y precios
echo.
echo Iniciando servidor local...
echo Cuando se abra Chrome, use: http://127.0.0.1:8765
echo Para cerrar, volve a esta ventana y presiona Ctrl+C.
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo No encuentro Python en esta computadora.
  echo Instale Python o avisame y lo resolvemos.
  pause
  exit /b 1
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8765'"
python server.py

echo.
echo El servidor se cerro. Si ve un error arriba, mandeme una captura.
pause
