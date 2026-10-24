@echo off
cd /d "%~dp0"
set PORT=8139
node server-headless-export-v2.js
pause
