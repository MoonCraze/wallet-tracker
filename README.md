# Wallet Tracker

A production-ready, real-time Solana wallet tracking and coordinated trade detection system built with Node.js, TypeScript, and PostgreSQL with TimescaleDB extensions.

> **✨ Recently Enhanced:** Now includes comprehensive wallet management API with automatic Helius webhook synchronization, web-based management interface, and cloud-first architecture with intelligent fallback.

## 🚀 What's New

- **Wallet Management API** - RESTful endpoints for programmatic wallet control
- **Web-based UI** - Intuitive interface at `/wallets.html` for managing tracked wallets
- **Automatic Webhook Sync** - Updates Helius webhooks instantly when wallets change
- **100 Wallet Limit** - Automatic enforcement with clear warnings and excess removal
- **Cloud Integration** - Fetches from cloud API with local file fallback
- **Persistent Storage** - Volume-mounted data survives container restarts
- **Real-time Validation** - Solana address format checking and duplicate removal
- **Complete Documentation** - Frontend-ready API docs with code examples

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Database](#database)
- [Security](#security)
- [Monitoring](#monitoring)
- [Development](#development)
- [Technology Stack](#technology-stack)
- [Contributing](#contributing)
- [License](#license)

## Overview

A sophisticated real-time monitoring system for Solana blockchain that tracks whale wallet activities and detects coordinated trading patterns. The system processes transaction data from Helius webhooks, analyzes trading behaviors across multiple wallets, and delivers instant notifications through real-time streaming.

**Key Capabilities:**
- Real-time whale wallet transaction monitoring
- Automated detection of coordinated trading activities
- Live data streaming with instant notifications
- Configurable alert thresholds and filtering
- RESTful API for system management
- Production-grade security and scalability

## Features

**Real-time Monitoring**
- Tracks whale wallet transactions as they occur on Solana blockchain
- Processes high-volume transaction data with minimal latency
- Automated daily updates of tracked wallet list with cloud API integration
- Intelligent fallback to local cache when cloud API is unavailable

**Coordinated Trade Detection**
- Identifies when multiple wallets buy the same token simultaneously
- Configurable detection windows and wallet count thresholds
- Instant alerts through live streaming API

**Wallet Management (NEW ✨)**
- **Web-based UI** for managing tracked wallet addresses
- **RESTful API endpoints** for programmatic wallet updates
- **Automatic Helius webhook synchronization** when wallets change
- **100 wallet limit enforcement** with automatic excess removal
- **Real-time validation** of Solana addresses
- **Duplicate detection** and automatic cleanup
- **Cloud-first architecture** with local file fallback
- **Persistent storage** via Docker volume mounts

**API & Integration**
- RESTful API for configuration and data access
- Real-time Server-Sent Events (SSE) for live updates
- JWT-based authentication for secure access
- CORS support for web applications
- Comprehensive wallet management endpoints (GET, PUT, POST add/remove)

**System Management**
- Runtime configuration without restarts
- Token filtering and amount thresholds
- Comprehensive health monitoring
- Structured logging for troubleshooting
- Automatic webhook updates on wallet changes
- Daily scheduled wallet synchronization

**Enterprise Ready**
- Docker containerization for easy deployment
- PostgreSQL with TimescaleDB for scalable storage
- Production-tested error handling
- Secure authentication and authorization
- Volume-mounted data persistence
- Automatic service restart on failure

## System Architecture

```
┌───────────────────────────────────────────────────────────┐
│              Client Applications                          │
│        (Web Dashboard, Mobile Apps, etc.)                 │
└────────────┬──────────────────────────────────────────────┘
             │
             ├─── REST API (Authenticated)
             └─── SSE Streams (Real-time)
             │
┌────────────▼──────────────────────────────────────────────┐
│              Application Server                            │
│   • Authentication & Authorization                         │
│   • Request Processing & Validation                        │
│   • Real-time Event Broadcasting                           │
└────────────┬──────────────────────────────────────────────┘
             │
      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼
  ┌────────┐  ┌──────────┐  ┌────────────┐
  │Helius  │  │ Database │  │ Background │
  │Webhook │  │ Storage  │  │  Scanner   │
  └────────┘  └──────────┘  └────────────┘
```

**How It Works:**
1. Helius sends transaction data via webhooks when tracked wallets trade
2. Application validates, processes, and stores transaction data
3. Background scanner analyzes patterns for coordinated trading
4. Real-time streams broadcast updates to connected clients
5. API provides access to configuration and historical data

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher with TimescaleDB extension
- **Docker** (optional, recommended for deployment)
- **Helius API Account** with webhook capability

### Local Development Setup

**1. Clone the repository**

**Linux/macOS:**
```bash
git clone <repository-url>
cd helius-wallet-tracker
```

**Windows (PowerShell):**
```powershell
git clone <repository-url>
cd helius-wallet-tracker
```

**2. Install dependencies**

**Linux/macOS:**
```bash
npm install
```

**Windows (PowerShell):**
```powershell
npm install
```

**3. Configure environment variables**

**Linux/macOS:**
```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
notepad .env  # or use your preferred editor
```

Configure these essential variables in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/helius_tracker"
WEBHOOK_SECRET="your-helius-webhook-secret"
JWT_SECRET="your-secure-random-string"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="SecurePassword123"
```

**4. Initialize the database**

**Linux/macOS:**
```bash
npm run db:generate
npm run db:migrate
```

**Windows (PowerShell):**
```powershell
npm run db:generate
npm run db:migrate
```

**5. Start the development server**

**Linux/macOS:**
```bash
npm run dev
```

**Windows (PowerShell):**
```powershell
npm run dev
```

**6. Verify the installation**

**Linux/macOS:**
```bash
curl http://localhost:8080/health
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri http://localhost:8080/health
# Or open in browser: http://localhost:8080/health
```

### Docker Deployment

For production deployments, use Docker Compose:

**Linux/macOS:**
```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Windows (PowerShell):**
```powershell
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Documentation

Comprehensive API documentation for frontend developers is available:
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete REST API and streaming reference
- **[public/docs/WALLET_API.md](public/docs/WALLET_API.md)** - Wallet management API for frontend developers

The documentation includes:
- Complete endpoint reference with request/response examples
- Authentication and security details
- Real-time streaming (SSE) usage
- Database schema documentation
- Configuration management
- **Wallet management endpoints with code examples**
- Error handling patterns
- Production-ready JavaScript classes
- 100 wallet limit enforcement details

### Quick Reference: Wallet Management API

**Authentication Required** - All wallet endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
# Returns: {"token": "eyJhbGc..."}
```

**Get Wallet List**
```bash
# Get current wallet list (includes source: cloud-api or local-file)
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/wallets

# Response:
# {
#   "success": true,
#   "count": 100,
#   "source": "local-file",
#   "wallets": ["7xKXtg2C...", "9vMJfxuK..."]
# }
```

**Update Wallet List** (Replace entire list - max 100 wallets)
```bash
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wallets": ["wallet1...", "wallet2..."]}' \
  http://localhost:8080/api/wallets

# Automatically:
# ✅ Updates wallets.json
# ✅ Triggers Helius webhook sync
# ✅ Enforces 100 wallet limit
# ✅ Removes duplicates
```

**Add Wallets** (Add to existing list)
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wallets": ["newWallet1...", "newWallet2..."]}' \
  http://localhost:8080/api/wallets/add

# Response includes:
# {
#   "success": true,
#   "added": 2,
#   "totalCount": 95
# }
```

**Remove Wallets**
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"wallets": ["walletToRemove1...", "walletToRemove2..."]}' \
  http://localhost:8080/api/wallets/remove

# Response includes:
# {
#   "success": true,
#   "removed": 2,
#   "totalCount": 93
# }
```

**Web Interface**

Access the web-based wallet management interface at: `http://localhost:8080/wallets.html`

Features:
- ✅ View all tracked wallets in an intuitive editor
- ✅ Add/remove/edit wallet addresses (one per line)
- ✅ Sort alphabetically and remove duplicates
- ✅ Real-time Solana address validation
- ✅ 100 wallet limit warnings
- ✅ Automatic webhook sync after updates
- ✅ Save with confirmation and error handling

**Automatic Webhook Updates**

When you update wallets via the API or web interface:
1. Wallets.json file is updated immediately
2. System triggers immediate webhook sync
3. Helius webhook is automatically updated with new addresses
4. New wallets start being monitored within seconds
5. All changes are logged for debugging


## Configuration

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `DIRECT_URL` | Direct connection for migrations | `postgresql://user:pass@localhost:5432/db` |
| `WEBHOOK_SECRET` | Helius webhook authentication | `your-webhook-secret-key` |
| `HELIUS_API_KEY` | Helius API key for webhook management | `your-helius-api-key` |
| `WEBHOOK_URL` | Your webhook endpoint URL | `https://your-domain.com/helius` |

#### Optional - Wallet Management

| Variable | Description | Default |
|----------|-------------|---------|
| `WALLETS_API_ENDPOINT` | Cloud API for wallet list | `` (uses local file only) |
| `WEBHOOK_ID` | Existing Helius webhook ID | `` (auto-detects by URL) |

#### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT token signing secret | `changeme` (insecure) |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password | `changeme` |

#### Server Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `NODE_ENV` | Environment mode | `development` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |
| `ALLOW_DEV_ENDPOINTS` | Enable dev endpoints | `false` |

#### Application Settings (Runtime Adjustable)

| Variable | Description | Default |
|----------|-------------|---------|
| `EXCLUDE_TOKENS` | Tokens to ignore | WSOL mint |
| `MIN_AMOUNT` | Minimum transfer amount | `1` |
| `COORDINATED_WINDOW_MINUTES` | Detection window | `5` |
| `COORDINATED_MIN_WALLETS` | Min wallets for alert | `5` |
| `DEBUG_EVENTS` | Enable event logging | `false` |

### Runtime Configuration

**Linux/macOS:**
```bash
# Get current configuration
curl -H "Authorization: Bearer <token>" http://localhost:8080/config

# Update settings
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"coordinatedWindowMinutes": 10}' \
  http://localhost:8080/config
```

**Windows (PowerShell):**
```powershell
# Get current configuration
Invoke-RestMethod -Uri http://localhost:8080/config -Headers @{Authorization="Bearer <token>"}

# Update settings
$body = @{coordinatedWindowMinutes=10} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8080/config -Method PATCH `
  -Headers @{Authorization="Bearer <token>"; "Content-Type"="application/json"} `
  -Body $body
```

## Deployment

### Production Deployment with Docker

**Step 1: Configure environment**

**Linux/macOS:**
```bash
cp .env.example .env
nano .env  # Edit with production values
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
notepad .env  # Edit with production values
```

**Step 2: Build and start services**

**Linux/macOS:**
```bash
docker-compose up --build -d
docker-compose ps
docker-compose logs -f app
```

**Windows (PowerShell):**
```powershell
docker-compose up --build -d
docker-compose ps
docker-compose logs -f app
```

**Step 3: Verify deployment**

**Linux/macOS:**
```bash
curl http://localhost:8080/health
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri http://localhost:8080/health
```

### Service Management

**Linux/macOS:**
```bash
# View logs
docker-compose logs -f

# Restart application
docker-compose restart app

# Stop all services
docker-compose down
```

**Windows (PowerShell):**
```powershell
# View logs
docker-compose logs -f

# Restart application
docker-compose restart app

# Stop all services
docker-compose down
```

### Cloudflare Tunnel for Public Access

**Linux:**
```bash
# Install cloudflared
curl -LO https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Start tunnel
cd Cloudfare
cloudflared tunnel --config ./cloudflared-config.yml run
```

**Windows (PowerShell):**
```powershell
# Download and install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Start tunnel
cd .\Cloudfare
cloudflared tunnel --config .\cloudflared-config.yml run
```

### Helius Webhook Configuration

Configure your Helius webhook to point to: `https://your-domain.com/helius`

Ensure the `WEBHOOK_SECRET` in your `.env` matches the secret in your Helius dashboard.

## Database

The system uses **PostgreSQL with TimescaleDB** for efficient time-series data storage.

### Data Storage

**Transaction Records:**
- Individual wallet transactions (buys and sells)
- Token transfer details and amounts
- Transaction timestamps and signatures

**Coordinated Trade Records:**
- Detected coordination patterns
- Involved wallet addresses
- Time windows and trigger times

### Database Management

**Linux/macOS:**
```bash
# View database in browser
npm run db:studio

# Apply schema changes
npm run db:migrate
```

**Windows (PowerShell):**
```powershell
# View database in browser
npm run db:studio

# Apply schema changes
npm run db:migrate
```

### Why TimescaleDB?

- Optimized for time-series transaction data
- Efficient querying of historical patterns
- Automatic data compression for older records
- Scales to millions of transactions

## Security

### Authentication & Authorization

- **JWT-based Authentication**: Secure token-based auth with 24-hour expiration
- **Webhook Secret Verification**: Multiple header format support
- **Role-based Access Control**: Admin role with extensible permissions
- **CORS Configuration**: Configurable origin restrictions

### Best Practices

1. Change default credentials before production
2. Use strong JWT secrets (minimum 32 characters)
3. Enable HTTPS in production
4. Restrict CORS origins to known domains
5. Monitor logs for suspicious activity
6. Keep dependencies updated
7. Use database connection pooling

## Monitoring

### Health Check

**Linux/macOS:**
```bash
curl http://localhost:8080/health
```

**Windows (PowerShell):**
```powershell
Invoke-RestMethod -Uri http://localhost:8080/health
```

**Response:**
```json
{
  "ok": true,
  "timestamp": "2026-01-10T12:34:56.789Z",
  "environment": "production"
}
```

### Application Logs

**Linux/macOS:**
```bash
# View Docker logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app
```

**Windows (PowerShell):**
```powershell
# View Docker logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app
```

### Real-time Monitoring

Access live streams at:
- Transfers: `http://localhost:8080/stream/transfers`
- Coordinated trades: `http://localhost:8080/stream/coordinated`
- All events: `http://localhost:8080/stream/all`

View demo pages:
- Dashboard: `http://localhost:8080/`
- Real-time test: `http://localhost:8080/realtime-test.html`

## Development

### Project Organization

```
helius-wallet-tracker/
├── src/                         # Application source code
│   ├── controllers/             # Request handlers
│   │   ├── auth.ts              # Authentication controller
│   │   ├── config.ts            # Configuration management
│   │   ├── wallets.ts           # Wallet management (NEW)
│   │   └── webhook.ts           # Helius webhook processor
│   ├── services/                # Business logic
│   │   ├── coordinator.ts       # Coordinated trade detection
│   │   ├── walletSync.ts        # Auto wallet sync & webhook updates (ENHANCED)
│   │   └── webhook.ts           # Webhook event processing
│   ├── routes/                  # API endpoints
│   │   ├── auth.ts              # Authentication routes
│   │   ├── config.ts            # Config routes
│   │   ├── wallets.ts           # Wallet management routes (NEW)
│   │   └── webhook.ts           # Webhook routes
│   ├── middleware/              # Auth & validation
│   │   ├── auth.ts              # Basic auth
│   │   ├── jwtAuth.ts           # JWT authentication
│   │   └── error.ts             # Error handling
│   ├── utils/                   # Helper functions
│   └── wallets.json             # Tracked wallet addresses (volume-mounted)
├── prisma/                      # Database schema & migrations
├── public/                      # Web interfaces
│   ├── index.html               # Dashboard
│   ├── login.html               # Login page
│   ├── wallets.html             # Wallet management UI (NEW)
│   └── docs/
│       └── WALLET_API.md        # Wallet API documentation (NEW)
├── docker-compose.yml           # Docker configuration (with volume mounts)
├── API_DOCUMENTATION.md         # Complete API reference
└── README.md                    # This file
```

### Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run db:studio` | Open database management UI |
| `npm run db:migrate` | Apply database migrations |
| `npm run wallets:sync` | Manually sync wallet list from cloud API |
| `npm run webhook:update` | Manually update Helius webhook (dev only) |

### Development Workflow

**Starting Development:**

**Linux/macOS:**
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

**Windows (PowerShell):**
```powershell
# Install dependencies
npm install

# Start development server
npm run dev
```

**Making Changes:**
1. Edit files in `src/` directory
2. Server automatically reloads on changes
3. Test using demo pages at `http://localhost:8080`
4. Test wallet management at `http://localhost:8080/wallets.html`
5. Check logs for any errors

**Updating Configuration:**
- Runtime settings: Use `/api/config` endpoint
- Wallet addresses: Use `/api/wallets` endpoint or web UI
- Environment variables: Edit `.env` file and restart
- Database schema: Update `prisma/schema.prisma` and run migrations

**Testing Wallet Management:**
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin@123"}' | jq -r '.token')

# Get current wallets
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/wallets

# Update wallets (triggers automatic webhook sync)
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"wallets":["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"]}' \
  http://localhost:8080/api/wallets
```

## Technology Stack

**Backend:**
- Node.js & TypeScript
- Express.js (REST API)
- Prisma ORM (Database)
- Server-Sent Events (Real-time)

**Database:**
- PostgreSQL 14+
- TimescaleDB (Time-series extension)

**Infrastructure:**
- Docker & Docker Compose
- Cloudflare Tunnel (Optional)

**External Services:**
- Helius API (Solana webhooks)

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Update documentation if needed
5. Submit a pull request

### Reporting Issues

Please include:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Node version)

## Documentation

- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete REST API and SSE reference
- **[public/docs/WALLET_API.md](public/docs/WALLET_API.md)** - Wallet management API for frontend developers
- **[Database Migration Guide](docs/DATABASE_MIGRATION_GUIDE.md)** - SQLite to PostgreSQL migration
- **[Wallet Sync Documentation](docs/WALLET_SYNC.md)** - Automated wallet management
- **[System Overview](docs/SYSTEM_OVERVIEW.md)** - Architecture and design decisions
- **[Docker Guide](DOCKER.md)** - Container deployment details

## Key Optimizations & Features

### ✅ Optimized Architecture

1. **Automatic Webhook Synchronization**
   - Wallet updates trigger immediate Helius webhook sync
   - No manual webhook management required
   - Updates complete in seconds

2. **Cloud-First with Local Fallback**
   - Fetches wallet list from cloud API first
   - Automatically falls back to local cache on failure
   - High availability even when external services are down

3. **Persistent Data Storage**
   - Docker volume mounts for wallets.json
   - Updates persist across container restarts
   - No data loss during redeployments

4. **100 Wallet Limit Enforcement**
   - Automatic validation and enforcement
   - Clear warnings when limit exceeded
   - Excess wallets automatically removed

5. **Real-time Validation**
   - Solana address format validation
   - Automatic duplicate detection and removal
   - Invalid addresses rejected immediately

6. **Production-Ready Error Handling**
   - Graceful fallback strategies
   - Comprehensive logging
   - Clear error messages for debugging

### 🎯 Performance Optimizations

- **Async webhook updates** - Non-blocking operations
- **Efficient data structures** - Set-based deduplication
- **TimescaleDB integration** - Optimized time-series queries
- **Connection pooling** - Efficient database access
- **Docker layer caching** - Fast rebuild times
- **Volume mounts** - No rebuild needed for data changes

### 🔒 Security Enhancements

- **JWT authentication** on all sensitive endpoints
- **24-hour token expiration**
- **Role-based access control**
- **Webhook secret verification**
- **Input validation** on all API endpoints
- **SQL injection prevention** via Prisma ORM

### 📊 Monitoring & Observability

- **Structured logging** with context
- **Health check endpoint**
- **Real-time event streaming**
- **Webhook sync confirmation logs**
- **Error tracking with stack traces**
- **Docker health checks**

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check existing documentation in the `docs/` directory
- Review the API documentation for integration questions

## Acknowledgments

- Built with [Helius](https://helius.xyz) Enhanced Webhooks
- Powered by [TimescaleDB](https://timescale.com) for time-series data
- Uses [Prisma ORM](https://prisma.io) for type-safe database access
