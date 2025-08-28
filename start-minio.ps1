Write-Host "Starting MinIO for SOAP AI..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
Write-Host "Checking if Docker is running..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting MinIO..." -ForegroundColor Yellow
Write-Host ""

# Start MinIO
docker-compose up -d

Write-Host ""
Write-Host "🎉 MinIO is starting up..." -ForegroundColor Green
Write-Host ""
Write-Host "📡 MinIO API: http://localhost:9000" -ForegroundColor Cyan
Write-Host "🖥️  MinIO Console: http://localhost:9001" -ForegroundColor Cyan
Write-Host "👤 Username: minioadmin" -ForegroundColor White
Write-Host "🔑 Password: minioadmin" -ForegroundColor White
Write-Host ""
Write-Host "To stop MinIO, run: docker-compose down" -ForegroundColor Yellow
Write-Host ""

# Wait for user input
Read-Host "Press Enter to continue"
