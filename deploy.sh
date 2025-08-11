#!/bin/bash

# Production deployment script for Helius Wallet Tracker
# Run this script to deploy the application in production mode

set -e

echo "🚀 Starting Helius Wallet Tracker Production Deployment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "📝 Please copy .env.production template and configure it:"
    echo "   cp .env.production.example .env.production"
    echo "   # Edit .env.production with your settings"
    exit 1
fi

# Load environment variables
set -a
source .env.production
set +a

echo "✅ Environment loaded from .env.production"

# Build and start the application
echo "🏗️  Building Docker image..."
docker-compose --env-file .env.production build

echo "🗄️  Setting up database..."
# Run database migrations in a temporary container
docker-compose --env-file .env.production run --rm helius-tracker sh -c "npx prisma migrate deploy && npx prisma generate"

echo "🚀 Starting application..."
docker-compose --env-file .env.production up -d

# Wait for health check
echo "⏳ Waiting for application to be healthy..."
timeout 60 bash -c '
while [[ "$(docker-compose ps helius-tracker --format json | jq -r ".[0].Health")" != "healthy" ]]; do
    echo "Waiting for health check..."
    sleep 5
done'

# Show status
docker-compose --env-file .env.production ps

echo ""
echo "🎉 Deployment successful!"
echo ""
echo "📊 Application is running at:"
echo "   Local:    http://localhost:8080"
echo "   Network:  http://$(hostname -I | cut -d' ' -f1):8080"
echo ""
echo "🔗 Available endpoints:"
echo "   Health:    http://localhost:8080/health"
echo "   SSE All:   http://localhost:8080/stream/all"
echo "   Dashboard: http://localhost:8080/realtime-test.html"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker-compose --env-file .env.production logs -f"
echo "   Stop:         docker-compose --env-file .env.production down"
echo "   Restart:      docker-compose --env-file .env.production restart"
echo "   Update:       ./deploy.sh"
echo ""

if [ ! -z "$WEBHOOK_URL" ]; then
    echo "🔗 Don't forget to update your Helius webhook URL to: $WEBHOOK_URL"
fi
