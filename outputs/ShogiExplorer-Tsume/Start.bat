@echo off
setlocal
cd /d "%~dp0"
title Tsume Training
if exist "%~dp0TsumeLauncher.exe" (
  start "" "%~dp0TsumeLauncher.exe"
  exit /b 0
)
set "PORT=19341"
set "APP=%~dp0TsumeLauncher.html"
set "SERVER=%~dp0server.ps1"

if not exist "%APP%" exit /b 1
if not exist "%SERVER%" exit /b 1

start "" /b "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER%" -Port %PORT%

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$u='http://127.0.0.1:%PORT%/api/health'; for($i=0;$i -lt 30;$i++){try{Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1 | Out-Null; exit 0}catch{}; Start-Sleep -Milliseconds 150}; exit 1" >nul 2>nul
start "" "http://127.0.0.1:%PORT%/"
endlocal
