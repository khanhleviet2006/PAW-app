@echo off
setlocal
cd /d "%~dp0backend" || exit /b 1
if not exist ".venv\Scripts\python.exe" goto setup
if not exist "..\frontend\dist\index.html" goto setup
if not exist ".env" goto setup
if not defined PAW_BIND_HOST set "PAW_BIND_HOST=127.0.0.1"
echo PAW: http://127.0.0.1:8000/map
".venv\Scripts\python.exe" scripts\launch.py
if errorlevel 1 (pause & exit /b 1)
exit /b %errorlevel%
:setup
echo Complete the Windows setup in README.md first.
pause
exit /b 1
