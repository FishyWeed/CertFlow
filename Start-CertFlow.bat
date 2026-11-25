@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Starting CertFlow...
echo ========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
    echo Docker Desktop is not installed yet.
    echo Opening the Docker Desktop download page...
    start "" "https://www.docker.com/products/docker-desktop/"
    echo.
    echo After installing and opening Docker Desktop, double-click Start-CertFlow.bat again.
    pause
    exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
    echo Docker Desktop is installed, but not running yet.
    echo Please open Docker Desktop, wait until it says Running, then double-click Start-CertFlow.bat again.
    pause
    exit /b 1
)

echo Starting CertFlow containers (first launch may take 1-2 minutes)...
docker compose up -d
if errorlevel 1 (
    echo.
    echo Could not start CertFlow. See the error above.
    pause
    exit /b 1
)

echo Waiting for CertFlow to become ready on http://localhost:3000 ...
powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(90); while ((Get-Date) -lt $deadline) { try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:3000/api/health'; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Seconds 2 }; exit 1"

echo Opening CertFlow in your browser...
start "" "http://localhost:3000"
echo.
echo CertFlow is running at http://localhost:3000
echo You can close this window safely. To stop CertFlow later, run: docker compose down
pause
