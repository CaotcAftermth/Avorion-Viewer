@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-server.ps1"
set "stopResult=%errorlevel%"
if not "%~1"=="--quiet" pause
exit /b %stopResult%
