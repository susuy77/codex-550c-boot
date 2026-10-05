@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\Rollback-Upgrade.ps1" -RestoreProfile
if errorlevel 1 (pause & exit /b 1)
pause
