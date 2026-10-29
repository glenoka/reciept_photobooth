@echo off
title Komaneka Receipt Memories - Restart HTTPS Server
cd /d "%~dp0"
echo ===================================================
echo Merestart Server HTTPS Komaneka Receipt Memories...
echo ===================================================

call stop_https.bat
ping 127.0.0.1 -n 2 >nul
start start_https.bat
