@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Upgrade-Codex.ps1"
if errorlevel 1 (pause & exit /b 1)
pause
