@echo off
SETLOCAL
cd /d "%~dp0"

echo.
echo  ====================================================
echo   n8n Local File System Agent
echo   Gives n8n access to YOUR Windows file system
echo  ====================================================
echo.

REM Check if Node is installed
node --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo [ERROR] Node.js not found! Please install from https://nodejs.org
  pause
  exit /b 1
)

REM Install dependencies if needed
IF NOT EXIST "node_modules" (
  echo [*] Installing dependencies...
  call npm install
  echo [OK] Dependencies installed.
  echo.
)

echo [*] Starting Local File Agent on http://localhost:3001 ...
echo [*] Keep this window open while using n8n file features.
echo.
echo  In n8n, use HTTP Request nodes pointing to:
echo    http://host.docker.internal:3001/...
echo.

node local_agent.js

pause
