# 🐳 Docker Deployment Guide

This document provides instructions for running the Helius Wallet Tracker in Docker.

## Quick Start

### 1. Build and Run with Docker

```bash
# Build the Docker image
docker build -t helius-wallet-tracker .

# Run with environment file
docker run --rm -p 8080:8080 --env-file .env helius-wallet-tracker
```

### 2. Run with Docker Compose (Recommended)

```bash
# Start all services (main app + Prisma Studio)
docker compose --env-file .env up -d

# View logs
docker compose logs -f helius-tracker

# Stop all services
docker compose down
```

## Environment Configuration

Use your existing `.env` file for Docker deployment. Make sure it includes production-ready values:

```bash
# Production Environment Configuration
DATABASE_URL=file:/app/data/production.db
PORT=8080
NODE_ENV=production
ALLOWED_ORIGINS=*
WEBHOOK_SECRET=super-secret-production-key
EXCLUDE_TOKENS=So11111111111111111111111111111111111111112
MIN_AMOUNT=1
COORDINATED_WINDOW_MINUTES=5
COORDINATED_MIN_WALLETS=5
DEDUP_BY_SIGNATURE_ONLY=false
DEBUG_EVENTS=false
DEBUG_EVENTS_VERBOSE=false
ALLOW_DEV_ENDPOINTS=false
```

## Available Services

### Main Application
- **Port**: 8080
- **Health Check**: http://localhost:8080/health
- **Config API**: http://localhost:8080/config
- **Webhook Endpoint**: http://localhost:8080/helius
- **SSE Streams**: 
  - http://localhost:8080/stream/transfers
  - http://localhost:8080/stream/coordinated
  - http://localhost:8080/stream/all

### Prisma Studio (Optional)
- **Port**: 5555
- **URL**: http://localhost:5555
- **Purpose**: Database management interface

## Testing the Deployment

```bash
# Test health endpoint
curl http://localhost:8080/health

# Test configuration
curl http://localhost:8080/config

# Test webhook (requires authentication)
curl -X POST http://localhost:8080/helius \
  -H "Content-Type: application/json" \
  -H "x-helius-secret: super-secret-production-key" \
  -d '{"test": "data"}'

# Test SSE stream
curl -N http://localhost:8080/stream/transfers
```

## Production Deployment

For production deployment:

1. **Update environment variables**:
   - Change `WEBHOOK_SECRET` to a secure value
   - Set `NODE_ENV=production`
   - Configure `ALLOWED_ORIGINS` for your domain
   - Disable `ALLOW_DEV_ENDPOINTS`

2. **Persist data**:
   - Database: `/app/data/production.db`
   - Logs: `/app/logs/`

3. **Monitor health**:
   - Health check: `GET /health`
   - Docker health check: Built-in

4. **Security**:
   - Non-root user (nodejs:nodejs)
   - Proper signal handling with dumb-init
   - Environment variable validation

## Docker Compose Features

- **Automatic restarts**: `restart: unless-stopped`
- **Health checks**: Built-in health monitoring
- **Volume persistence**: Database and logs persist between restarts
- **Network isolation**: Services run in isolated network
- **Resource management**: Production-optimized container

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure port 8080 is available
2. **Permission issues**: Check file permissions on mounted volumes
3. **Database errors**: Prisma initialization warnings are normal on first run
4. **Webhook authentication**: Verify `WEBHOOK_SECRET` matches your Helius configuration

### Useful Commands

```bash
# View container logs
docker compose logs helius-tracker

# Execute commands in container
docker compose exec helius-tracker sh

# Rebuild and restart
docker compose up --build -d

# View resource usage
docker compose top
```

## Architecture Benefits

✅ **Production Ready**: Multi-stage build with security best practices  
✅ **Scalable**: Easy to deploy multiple instances  
✅ **Maintainable**: Clean separation of concerns  
✅ **Observable**: Health checks and structured logging  
✅ **Secure**: Non-root user, proper signal handling  
✅ **Persistent**: Data survives container restarts  

The Docker deployment provides a robust, production-ready environment for the Helius Wallet Tracker application.
