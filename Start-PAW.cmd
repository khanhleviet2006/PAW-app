@echo off
setlocal
cd /d "%~dp0backend" || exit /b 1
if not exist ".venv\Scripts\python.exe" goto setup
if not exist "..\frontend\dist\index.html" goto setup
if not exist ".env" goto setup
if not defined PAW_BIND_HOST set "PAW_BIND_HOST=127.0.0.1"
echo PAW: http://127.0.0.1:8000/map
".venv\Scripts\python.exe" -m uvicorn app.asgi:app --host "%PAW_BIND_HOST%" --port 8000 --no-proxy-headers
exit /b %errorlevel%
:setup
echo Complete the Windows setup in README.md first.
pause
exit /b 1
