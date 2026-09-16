@echo off
cd /d "%~dp0"
if not exist node_modules (call npm install)
echo Iniciando KP HOSTS Agent...
node src\agent.js
pause
