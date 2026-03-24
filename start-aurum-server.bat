@echo off
cd /d "%~dp0"
echo Starting Aurum Intelligence server on http://localhost:3000
node src\server.js
pause
