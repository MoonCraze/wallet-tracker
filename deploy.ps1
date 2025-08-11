# Windows PowerShell deployment script for Helius Wallet Tracker
# Run this script to deploy the application in production mode

param(
    [switch]$Force = $false
)

Write-Host "🚀 Starting Helius Wallet Tracker Production Deployment..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env.production exists
if (!(Test-Path ".env.production")) {
    Write-Host "❌ .env.production file not found!" -ForegroundColor Red
    Write-Host "📝 Please copy .env.production template and configure it:" -ForegroundColor Yellow
    Write-Host "   Copy-Item .env.production .env.production.configured" -ForegroundColor Cyan
    Write-Host "   # Edit .env.production.configured with your settings" -ForegroundColor Cyan
    Write-Host "   # Then rename it to .env.production" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Environment file found" -ForegroundColor Green

# Build and start the application
Write-Host "🏗️  Building Docker image..." -ForegroundColor Blue
docker-compose --env-file .env.production build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🗄️  Setting up database..." -ForegroundColor Blue
docker-compose --env-file .env.production run --rm helius-tracker sh -c 'npx prisma migrate deploy; npx prisma generate'

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Database setup failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Starting application..." -ForegroundColor Blue
docker-compose --env-file .env.production up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start application" -ForegroundColor Red
    exit 1
}

# Wait for health check
Write-Host "⏳ Waiting for application to be healthy..." -ForegroundColor Yellow
$timeout = 60
$elapsed = 0
do {
    Start-Sleep 5
    $elapsed += 5
    try {
        $health = docker-compose --env-file .env.production ps --format json | ConvertFrom-Json | Where-Object { $_.Service -eq "helius-tracker" } | Select-Object -ExpandProperty Health -ErrorAction SilentlyContinue
        Write-Host "Health status: $health" -ForegroundColor Cyan
    } catch {
        Write-Host "Checking health..." -ForegroundColor Cyan
    }
} while ($health -ne "healthy" -and $elapsed -lt $timeout)

if ($health -ne "healthy") {
    Write-Host "⚠️  Health check timeout, but application may still be starting..." -ForegroundColor Yellow
}

# Show status
Write-Host "`n📊 Container Status:" -ForegroundColor Blue
docker-compose --env-file .env.production ps

# Get local IP for network access
$localIP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*","Ethernet*" | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } | Select-Object -First 1).IPAddress

Write-Host "`n🎉 Deployment successful!" -ForegroundColor Green -BackgroundColor DarkGreen
Write-Host "`n📊 Application is running at:" -ForegroundColor Blue
Write-Host "   Local:    http://localhost:8080" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "   Network:  http://${localIP}:8080" -ForegroundColor Cyan
}
Write-Host "`n🔗 Available endpoints:" -ForegroundColor Blue
Write-Host "   Health:    http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "   SSE All:   http://localhost:8080/stream/all" -ForegroundColor Cyan
Write-Host "   Dashboard: http://localhost:8080/realtime-test.html" -ForegroundColor Cyan
Write-Host "`n📝 Useful commands:" -ForegroundColor Blue
Write-Host "   View logs:    docker-compose --env-file .env.production logs -f" -ForegroundColor Cyan
Write-Host "   Stop:         docker-compose --env-file .env.production down" -ForegroundColor Cyan
Write-Host "   Restart:      docker-compose --env-file .env.production restart" -ForegroundColor Cyan
Write-Host "   Update:       .\deploy.ps1" -ForegroundColor Cyan

# Get webhook URL from env file
$webhookUrl = Get-Content .env.production | Where-Object { $_ -match "^WEBHOOK_URL=" } | ForEach-Object { $_.Split("=")[1] }
if ($webhookUrl) {
    Write-Host "`n🔗 Don't forget to update your Helius webhook URL to: $webhookUrl" -ForegroundColor Yellow
}
