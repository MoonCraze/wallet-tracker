# Helius Wallet Tracker - Tunnel Management Script
# This script helps you manage the Cloudflare tunnel for internet access

param(
    [ValidateSet("start", "stop", "status", "test")]
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-TunnelConnection {
    try {
        Write-ColorOutput "🔍 Testing tunnel connection..." "Cyan"
        $response = Invoke-RestMethod -Uri "https://helius.wonderswhisper.com/health" -TimeoutSec 10
        if ($response.ok) {
            Write-ColorOutput "✅ Tunnel is working! Your app is accessible at:" "Green"
            Write-ColorOutput "   https://helius.wonderswhisper.com" "Yellow"
            return $true
        }
    } catch {
        Write-ColorOutput "❌ Tunnel connection failed: $($_.Exception.Message)" "Red"
        return $false
    }
}

function Start-Tunnel {
    Write-ColorOutput "🚀 Starting Cloudflare tunnel..." "Green"
    
    # Check if Docker container is running
    $containerStatus = docker-compose --env-file .env.production ps --format json | ConvertFrom-Json | Where-Object { $_.Service -eq "helius-tracker" }
    if (-not $containerStatus -or $containerStatus.State -ne "running") {
        Write-ColorOutput "⚠️  Docker container is not running. Starting it first..." "Yellow"
        docker-compose --env-file .env.production up -d
        Start-Sleep 10
    }
    
    # Test local application first
    try {
        $localTest = Invoke-RestMethod -Uri "http://localhost:8080/health" -TimeoutSec 5
        Write-ColorOutput "✅ Local application is running" "Green"
    } catch {
        Write-ColorOutput "❌ Local application is not responding. Please check Docker container." "Red"
        return
    }
    
    # Start the tunnel
    Write-ColorOutput "🌐 Starting tunnel (this will run in the background)..." "Cyan"
    Write-ColorOutput "💡 Keep this PowerShell window open to maintain the tunnel" "Yellow"
    Write-ColorOutput "💡 Press Ctrl+C to stop the tunnel" "Yellow"
    Write-ColorOutput "" "White"
    
    # Run tunnel
    cloudflared tunnel --config cloudflared-config.yml run
}

function Stop-Tunnel {
    Write-ColorOutput "🛑 Stopping Cloudflare tunnel..." "Yellow"
    
    # Find and kill cloudflared processes
    $processes = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($processes) {
        $processes | Stop-Process -Force
        Write-ColorOutput "✅ Tunnel stopped" "Green"
    } else {
        Write-ColorOutput "ℹ️  No tunnel processes found" "Cyan"
    }
}

function Show-Status {
    Write-ColorOutput "📊 Helius Wallet Tracker Status" "Blue"
    Write-ColorOutput "=================================" "Blue"
    
    # Check Docker status
    Write-ColorOutput "`n🐳 Docker Status:" "Cyan"
    try {
        $containerStatus = docker-compose --env-file .env.production ps --format json | ConvertFrom-Json | Where-Object { $_.Service -eq "helius-tracker" }
        if ($containerStatus) {
            $status = $containerStatus.State
            $health = $containerStatus.Health
            Write-ColorOutput "   Container: $status $(if($health) { "($health)" })" $(if($status -eq "running") { "Green" } else { "Red" })
        } else {
            Write-ColorOutput "   Container: Not found" "Red"
        }
    } catch {
        Write-ColorOutput "   Container: Error checking status" "Red"
    }
    
    # Check local application
    Write-ColorOutput "`n🏠 Local Application:" "Cyan"
    try {
        $localTest = Invoke-RestMethod -Uri "http://localhost:8080/health" -TimeoutSec 5
        Write-ColorOutput "   http://localhost:8080: ✅ Healthy" "Green"
    } catch {
        Write-ColorOutput "   http://localhost:8080: ❌ Not responding" "Red"
    }
    
    # Check tunnel
    Write-ColorOutput "`n🌐 Cloudflare Tunnel:" "Cyan"
    $tunnelProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($tunnelProcess) {
        Write-ColorOutput "   Process: ✅ Running (PID: $($tunnelProcess.Id -join ', '))" "Green"
        
        # Test tunnel connection
        if (Test-TunnelConnection) {
            Write-ColorOutput "`n🎉 Your app is accessible from anywhere at:" "Green"
            Write-ColorOutput "   🌍 Main Dashboard: https://helius.wonderswhisper.com/realtime-test.html" "Yellow"
            Write-ColorOutput "   📱 Remote Client: https://helius.wonderswhisper.com/remote-client.html" "Yellow"
            Write-ColorOutput "   📡 SSE Stream: https://helius.wonderswhisper.com/stream/all" "Yellow"
        }
    } else {
        Write-ColorOutput "   Process: ❌ Not running" "Red"
        Write-ColorOutput "   Run: .\tunnel.ps1 start" "Yellow"
    }
    
    Write-ColorOutput "`n📝 Available Commands:" "Cyan"
    Write-ColorOutput "   .\tunnel.ps1 start   - Start the tunnel" "White"
    Write-ColorOutput "   .\tunnel.ps1 stop    - Stop the tunnel" "White"
    Write-ColorOutput "   .\tunnel.ps1 status  - Show this status" "White"
    Write-ColorOutput "   .\tunnel.ps1 test    - Test tunnel connection" "White"
}

# Main script logic
switch ($Action) {
    "start" { Start-Tunnel }
    "stop" { Stop-Tunnel }
    "status" { Show-Status }
    "test" { 
        if (Test-TunnelConnection) {
            Write-ColorOutput "✅ Tunnel test successful!" "Green"
        } else {
            Write-ColorOutput "❌ Tunnel test failed!" "Red"
        }
    }
}
