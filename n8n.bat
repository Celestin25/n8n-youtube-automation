@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

set PROJECT_DIR=%~dp0
cd /d "%PROJECT_DIR%"

echo.
echo  ███╗   ██╗ █████╗ ███╗  ██╗
echo  ████╗  ██║██╔══██╗████╗ ██║
echo  ██╔██╗ ██║╚█████╔╝██╔██╗██║
echo  ██║╚██╗██║██╔══██╗██║╚████║
echo  ██║ ╚████║╚█████╔╝██║ ╚███║
echo  ╚═╝  ╚═══╝ ╚════╝ ╚═╝  ╚══╝
echo  Work Automation — n8n Launcher
echo ─────────────────────────────────
echo.

IF "%1"=="stop" GOTO stop
IF "%1"=="restart" GOTO restart
IF "%1"=="logs" GOTO logs
IF "%1"=="update" GOTO update
IF "%1"=="backup" GOTO backup
IF "%1"=="status" GOTO status

:start
echo [*] Starting n8n and PostgreSQL...
docker compose up -d
echo.
echo [✓] n8n is running!
echo [→] Open in browser: http://localhost:5678
echo.
echo Commands:
echo   n8n.bat stop      — Stop n8n
echo   n8n.bat restart   — Restart n8n
echo   n8n.bat logs      — View live logs
echo   n8n.bat update    — Pull latest n8n image
echo   n8n.bat backup    — Export all workflows
echo   n8n.bat status    — Check container status
GOTO end

:stop
echo [*] Stopping n8n...
docker compose down
echo [✓] n8n stopped.
GOTO end

:restart
echo [*] Restarting n8n...
docker compose restart n8n
echo [✓] n8n restarted. → http://localhost:5678
GOTO end

:logs
echo [*] Showing n8n logs (Ctrl+C to exit)...
docker compose logs -f n8n
GOTO end

:update
echo [*] Pulling latest n8n image...
docker compose pull n8n
docker compose up -d --no-deps n8n
echo [✓] n8n updated!
GOTO end

:backup
echo [*] Exporting workflows to .\backups\...
IF NOT EXIST "backups" mkdir backups
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
docker exec n8n_app n8n export:workflow --all --output=/backups/workflows_%TIMESTAMP%.json
echo [✓] Backup saved to backups\workflows_%TIMESTAMP%.json
GOTO end

:status
echo [*] Container status:
docker compose ps
GOTO end

:end
ENDLOCAL
