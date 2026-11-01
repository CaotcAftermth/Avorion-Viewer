@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-server.ps1" %*
set "startResult=%errorlevel%"
if not "%startResult%"=="0" pause
exit /b %startResult%
