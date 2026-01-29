# Deployment Guide - Helius Wallet Tracker

## Overview

This guide covers deploying the Helius Wallet Tracker to production using Docker and Cloudflare Tunnel with the domain `helius.sarislabs.com`.

## Prerequisites

- Docker and Docker Compose installed
- Cloudflare account with domain `sarislabs.com`
- Cloudflared installed and authenticated
- Node.js 18+ (for local development)
- Helius API key

## Quick Start

### 1. Environment Setup

Create or verify your `.env.production` file:

```bash
# Helius Configuration
HELIUS_API_KEY=your-api-key-here
WEBHOOK_URL=https://helius.sarislabs.com/helius
WEBHOOK_SECRET=helius-production-secret-2025

# Wallet Sync Configuration
WALLETS_API_ENDPOINT=https://your-api-endpoint.com/api/v1/traders/top/ranked

# Database Configuration
DATABASE_URL=file:/app/data/production.db

# CORS Configuration
ALLOWED_ORIGINS=*

# Server Configuration
NODE_ENV=production
PORT=8080

# Filter Configuration
EXCLUDE_TOKENS=So11111111111111111111111111111111111111112
MIN_AMOUNT=1
DEDUP_BY_SIGNATURE_ONLY=0

# Coordination Detection
COORDINATED_WINDOW_MINUTES=5
COORDINATED_MIN_WALLETS=3

# Debug Configuration
DEBUG_EVENTS=1
DEBUG_EVENTS_VERBOSE=0

# Development endpoints
ALLOW_DEV_ENDPOINTS=1
```

### 2. Start Docker Containers

```bash
# Stop any existing containers
docker-compose down

# Build and start with production environment
docker-compose --env-file .env.production up -d --build
```

### 3. Verify Docker Containers

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f helius-tracker

# Expected output should show:
# - Server started on port 8080
# - Coordinated trade scanner started
# - Wallet sync service started
# - Loaded X wallets from existing file (if API unavailable)
```

### 4. Start Cloudflare Tunnel

```bash
# Navigate to Cloudflare directory
cd Cloudfare

# Start the tunnel
cloudflared tunnel --config .\cloudflared-config.yml run
```

The tunnel configuration should point to:
- **Hostname**: `helius.sarislabs.com`
- **Service**: `http://localhost:8080`

### 5. Update Helius Webhook

```bash
# Return to project root
cd ..

# Update webhook to use new domain
npm run webhook:update
```

This will configure Helius to send webhooks to `https://helius.sarislabs.com/helius`

### 6. Verify Deployment

Test the health endpoint:

```bash
# Wait for DNS propagation (may take 1-5 minutes)
curl https://helius.sarislabs.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-11T08:00:00.000Z"
}
```

## Production URLs

Once deployed, the following endpoints are available:

- **Health Check**: `https://helius.sarislabs.com/health`
- **Webhook Endpoint**: `https://helius.sarislabs.com/helius` (POST)
- **Configuration**: `https://helius.sarislabs.com/config` (GET/PATCH)
- **Transfer Stream**: `https://helius.sarislabs.com/stream/transfers` (SSE)
- **Coordinated Trades Stream**: `https://helius.sarislabs.com/stream/coordinated` (SSE)
- **Combined Stream**: `https://helius.sarislabs.com/stream/all` (SSE)

## Cloudflare Tunnel Setup

### Initial Tunnel Configuration

If you need to set up the tunnel from scratch:

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create a new tunnel (or use existing)
cloudflared tunnel create helius-tracker

# Add DNS route
cloudflared tunnel route dns <TUNNEL_ID> helius.sarislabs.com

# Verify tunnel info
cloudflared tunnel info <TUNNEL_ID>
```

### Tunnel Configuration File

Your `Cloudfare/cloudflared-config.yml` should contain:

```yaml
tunnel: c8e67b13-2249-4281-8170-7744ff8fdfa2
credentials-file: ~/.cloudflared/c8e67b13-2249-4281-8170-7744ff8fdfa2.json

ingress:
  - hostname: helius.sarislabs.com
    service: http://localhost:8080
  - service: http_status:404
```

## Maintenance Commands

### View Logs

```bash
# Container logs
docker-compose logs -f helius-tracker

# Last 100 lines
docker-compose logs --tail=100 helius-tracker

# Specific container
docker logs <container-id>
```

### Restart Services

```bash
# Restart all containers
docker-compose restart

# Restart specific service
docker-compose restart helius-tracker

# Full rebuild
docker-compose down
docker-compose up -d --build
```

### Database Management

```bash
# Access Prisma Studio (runs on localhost:5555)
docker-compose up prisma-studio

# Run migrations
docker exec helius-wallet-tracker-helius-tracker-1 npx prisma migrate deploy

# View database
docker exec -it helius-wallet-tracker-helius-tracker-1 sh
ls /app/data
```

### Wallet Sync

```bash
# Manual wallet sync (if API is available)
npm run wallets:sync

# Check current wallets
docker exec helius-wallet-tracker-helius-tracker-1 cat /app/dist/wallets.json
```

## Monitoring

### Health Checks

```bash
# HTTP health check
curl https://helius.sarislabs.com/health

# Docker health status
docker inspect helius-wallet-tracker-helius-tracker-1 | grep -A 10 Health

# Container stats
docker stats helius-wallet-tracker-helius-tracker-1
```

### Real-time Monitoring

Connect to SSE streams for live monitoring:

```bash
# Monitor all events
curl -N https://helius.sarislabs.com/stream/all

# Monitor coordinated trades only
curl -N https://helius.sarislabs.com/stream/coordinated
```

## Troubleshooting

### DNS Not Resolving

```bash
# Check DNS with Google DNS
nslookup helius.sarislabs.com 8.8.8.8

# Flush local DNS cache
ipconfig /flushdns  # Windows
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux
```

### Container Issues

```bash
# Check container status
docker ps -a | grep helius

# View full logs
docker-compose logs --no-log-prefix helius-tracker

# Restart containers
docker-compose restart

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

### Tunnel Not Working

```bash
# Check tunnel status
cloudflared tunnel info c8e67b13-2249-4281-8170-7744ff8fdfa2

# Check tunnel process
Get-Process cloudflared

# Restart tunnel
Stop-Process -Name cloudflared
cd Cloudfare
cloudflared tunnel --config .\cloudflared-config.yml run
```

### Webhook Not Receiving Events

```bash
# Verify webhook configuration
npm run webhook:update

# Check logs for incoming requests
docker-compose logs -f helius-tracker | Select-String "POST /helius"

# Test webhook manually
curl -X POST https://helius.sarislabs.com/helius \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-webhook-secret" \
  -d '[]'
```

## Security Considerations

1. **Webhook Secret**: Keep `WEBHOOK_SECRET` secure and never commit to git
2. **API Keys**: Store `HELIUS_API_KEY` in environment variables only
3. **CORS**: Restrict `ALLOWED_ORIGINS` in production if needed
4. **Firewall**: Docker container runs on localhost only, exposed via Cloudflare Tunnel
5. **SSL/TLS**: Handled automatically by Cloudflare

## Backup and Recovery

### Backup Database

```bash
# Copy database from container
docker cp helius-wallet-tracker-helius-tracker-1:/app/data/production.db ./backup-$(date +%Y%m%d).db

# Or use volume backup
docker run --rm -v helius_data:/data -v $(pwd):/backup alpine tar czf /backup/helius_data_backup.tar.gz -C /data .
```

### Restore Database

```bash
# Copy database to container
docker cp ./backup-20251211.db helius-wallet-tracker-helius-tracker-1:/app/data/production.db

# Restart container
docker-compose restart helius-tracker
```

## Performance Tuning

### Docker Resources

Adjust Docker resource limits in `docker-compose.yml`:

```yaml
services:
  helius-tracker:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Database Optimization

```bash
# Connect to container
docker exec -it helius-wallet-tracker-helius-tracker-1 sh

# Run Prisma optimize
npx prisma db push
```

## Update Procedure

1. Pull latest changes
2. Stop containers: `docker-compose down`
3. Rebuild: `docker-compose build --no-cache`
4. Start: `docker-compose --env-file .env.production up -d`
5. Verify: `curl https://helius.sarislabs.com/health`

## Support

For issues:
1. Check logs: `docker-compose logs helius-tracker`
2. Verify environment variables in `.env.production`
3. Test local endpoint: `curl http://localhost:8080/health`
4. Check Cloudflare tunnel status
5. Verify DNS resolution

## Quick Reference

```bash
# Full deployment from scratch
docker-compose down
docker-compose --env-file .env.production up -d --build
cd Cloudfare && cloudflared tunnel --config .\cloudflared-config.yml run

# Quick restart
docker-compose restart

# View logs
docker-compose logs -f helius-tracker

# Update webhook
npm run webhook:update

# Health check
curl https://helius.sarislabs.com/health
```
