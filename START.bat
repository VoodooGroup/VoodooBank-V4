@echo off
title Voodoo Token Bank
cd /d "%~dp0"
echo.
echo  Close any old "Voodoo Token Bank" server windows first.
echo  Starting local server (MetaMask + multipliers require this)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause