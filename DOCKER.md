# 🐳 Docker Deployment Guide

This document provides instructions for running the Helius Wallet Tracker in Docker with PostgreSQL.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (e.g., Neon.tech, Supabase, or self-hosted)
- `.env.production` file configured with database credentials

## Quick Start

### 1. Prepare Environment File

Copy the example environment file and fill in your values:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your PostgreSQL connection string and other settings.

### 2. Build and Run with Docker Compose (Recommended)

```bash
# Build and start the service
docker compose --env-file .env.production up -d

# View logs
docker compose logs -f helius-tracker

# Stop the service
docker compose down
```

### 3. Alternative: Run with Docker directly

```bash
# Build the Docker image
docker build -t helius-wallet-tracker .

# Run with environment file
docker run -d \
  -p 8080:8080 \
  --name helius-tracker \
  --env-file .env.production \
  --restart unless-stopped \
  helius-wallet-tracker

# View logs
docker logs -f helius-tracker

# Stop and remove
docker stop helius-tracker && docker rm helius-tracker
```

## Environment Configuration

Required environment variables in `.env.production`:

```bash
# Database (PostgreSQL - Required)
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host:port/database?sslmode=require"

# Helius API
HELIUS_API_KEY=your-helius-api-key
WEBHOOK_URL=https://yourdomain.com/helius
WEBHOOK_SECRET=your-secure-webhook-secret

# Server
PORT=8080
NODE_ENV=production

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# CORS
ALLOWED_ORIGINS=https://yourdomain.com

# Security (Production)
ALLOW_DEV_ENDPOINTS=0  # Disable dev endpoints
DEBUG_EVENTS=0

# Features
COORDINATED_WINDOW_MINUTES=5
COORDINATED_MIN_WALLETS=5
MIN_AMOUNT=1
DEDUP_BY_SIGNATURE_ONLY=0
```

## Available Endpoints

### Main Application
- **Port**: 8080
- **Health Check**: `GET http://localhost:8080/health`
- **Config API**: `GET http://localhost:8080/config`
- **Webhook Endpoint**: `POST http://localhost:8080/helius`
- **SSE Stream**: `GET http://localhost:8080/sse`
- **Auth API**: 
  - `POST http://localhost:8080/api/auth/login`
  - `POST http://localhost:8080/api/auth/logout`
  - `GET http://localhost:8080/api/auth/me`

### Development Endpoints (if ALLOW_DEV_ENDPOINTS=1)
⚠️ **Disable in production for security!**
- `GET /dev/db/transfers?limit=50` - View transfers
- `GET /dev/db/coordinated?limit=50` - View coordinated trades
- `GET /dev/db/stats` - Database statistics

## Testing the Deployment

```bash
# 1. Test health endpoint
curl http://localhost:8080/health

# 2. Test authentication
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 3. Test webhook (requires Helius signature)
curl -X POST http://localhost:8080/helius \
  -H "Content-Type: application/json" \
  -H "x-helius-secret: your-webhook-secret" \
  -d '{"test": "data"}'

# 4. Test SSE stream
curl -N http://localhost:8080/sse

# 5. Test database stats (if dev endpoints enabled)
curl http://localhost:8080/dev/db/stats
```

## Production Deployment Best Practices

### 1. Security
```bash
# In .env.production
ALLOW_DEV_ENDPOINTS=0          # Disable dev endpoints
DEBUG_EVENTS=0                 # Disable event logging
JWT_SECRET=min-32-chars-random # Strong JWT secret
ADMIN_PASSWORD=strong-password # Strong admin password
ALLOWED_ORIGINS=https://yourdomain.com  # Specific origins only
```

### 2. Database
- Use **PostgreSQL with TimescaleDB** for optimal performance
- Use connection pooling (e.g., Neon pooler, PgBouncer)
- Ensure SSL/TLS is enabled (`sslmode=require`)
- Regular backups of PostgreSQL database

### 3. Monitoring
```bash
# View real-time logs
docker compose logs -f helius-tracker

# Check container health
docker ps
docker inspect helius-tracker

# Resource usage
docker stats helius-tracker
```

### 4. Updates and Maintenance
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose --env-file .env.production up -d --build

# Or for Docker directly
docker build -t helius-wallet-tracker .
docker stop helius-tracker
docker rm helius-tracker
docker run -d -p 8080:8080 --env-file .env.production --name helius-tracker helius-wallet-tracker
```

## Persistent Data

With PostgreSQL, data persistence is handled by your external database provider (Neon.tech, Supabase, etc.).

**Logs** are persisted in a Docker volume:
```bash
# View logs volume
docker volume inspect helius-wallet-tracker_helius_logs

# Backup logs
docker run --rm -v helius-wallet-tracker_helius_logs:/logs -v $(pwd):/backup alpine tar czf /backup/logs-backup.tar.gz /logs
```

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection from container
docker exec helius-tracker npx tsx -e "import pkg from 'pg'; const {Client} = pkg; const c = new Client({connectionString: process.env.DATABASE_URL}); await c.connect(); console.log('Connected!'); await c.end();"

# Check environment variables
docker exec helius-tracker env | grep DATABASE_URL
```

### Container Won't Start
```bash
# View full logs
docker logs helius-tracker

# Check health status
docker inspect helius-tracker | grep -A 10 Health
```

### Performance Issues
```bash
# Monitor resource usage
docker stats helius-tracker

# Increase memory limit if needed
docker run -d -p 8080:8080 --memory="1g" --env-file .env.production helius-wallet-tracker
```

## Cloud Deployment

### Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Deploy to Render
1. Connect your GitHub repository
2. Create new Web Service
3. Set build command: `npm install && npx prisma generate && npm run build`
4. Set start command: `node dist/app.js`
5. Add environment variables from `.env.production`

### Deploy to fly.io
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

---

## Summary

✅ **Updated for PostgreSQL**: No more SQLite volumes needed  
✅ **Authentication**: JWT-based auth included  
✅ **TimescaleDB Ready**: Optimized for time-series data  
✅ **Production Security**: Dev endpoints disabled by default  
✅ **Health Checks**: Built-in health monitoring  
✅ **Logs Persistence**: Logs saved in Docker volume  

For more details, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [DATABASE_RECOMMENDATIONS.md](docs/DATABASE_RECOMMENDATIONS.md) - Database setup
- [TIMESCALEDB_SETUP_COMPLETE.md](docs/TIMESCALEDB_SETUP_COMPLETE.md) - TimescaleDB features


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
