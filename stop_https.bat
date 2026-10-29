@echo off
title Komaneka Receipt Memories - Stop HTTPS Server
cd /d "%~dp0"
echo ===================================================
echo Menghentikan Server HTTPS Komaneka Receipt Memories...
echo ===================================================

:: 1. Hentikan process python server.py
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Where-Object { $_.CommandLine -like '*server.py*' } | Stop-Process -Force -ErrorAction SilentlyContinue"

:: 2. Hentikan process di port 8443 jika masih ada
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8443 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo ===================================================
echo Server HTTPS berhasil dihentikan.
echo ===================================================
ping 127.0.0.1 -n 2 >nul
