@echo off
echo Starting MinIO for SOAP AI...
echo.

echo Checking if Docker is running...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Docker is running. Starting MinIO...
echo.

docker-compose up -d

echo.
echo MinIO is starting up...
echo.
echo MinIO API: http://localhost:9000
echo MinIO Console: http://localhost:9001
echo Username: minioadmin
echo Password: minioadmin
echo.
echo To stop MinIO, run: docker-compose down
echo.
pause
