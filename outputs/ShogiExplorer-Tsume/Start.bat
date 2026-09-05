@echo off
setlocal
cd /d "%~dp0"
title Tsume Training
if not exist "%~dp0TsumeLauncher.exe" (
  echo TsumeLauncher.exe not found.
  echo Please download the Windows release package or publish the host project first.
  pause
  exit /b 1
)
start "" "%~dp0TsumeLauncher.exe"
endlocal
