# Wallet Tracker

A production-ready, real-time Solana wallet tracking and coordinated trade detection system built with Node.js, TypeScript, and PostgreSQL with TimescaleDB extensions.

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
- Automated daily updates of tracked wallet list

**Coordinated Trade Detection**
- Identifies when multiple wallets buy the same token simultaneously
- Configurable detection windows and wallet count thresholds
- Instant alerts through live streaming API

**API & Integration**
- RESTful API for configuration and data access
- Real-time Server-Sent Events (SSE) for live updates
- JWT-based authentication for secure access
- CORS support for web applications

**System Management**
- Runtime configuration without restarts
- Token filtering and amount thresholds
- Comprehensive health monitoring
- Structured logging for troubleshooting

**Enterprise Ready**
- Docker containerization for easy deployment
- PostgreSQL with TimescaleDB for scalable storage
- Production-tested error handling
- Secure authentication and authorization

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

Comprehensive API documentation for frontend developers is available in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

The documentation includes:
- Complete endpoint reference with request/response examples
- Authentication and security details
- Real-time streaming (SSE) usage
- Database schema documentation
- Configuration management
- Error handling patterns
- Production-ready code examples

## Configuration

### Environment Variables

#### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `DIRECT_URL` | Direct connection for migrations | `postgresql://user:pass@localhost:5432/db` |
| `WEBHOOK_SECRET` | Helius webhook authentication | `your-webhook-secret-key` |

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
│   ├── services/                # Business logic
│   ├── routes/                  # API endpoints
│   ├── middleware/              # Auth & validation
│   └── utils/                   # Helper functions
├── prisma/                      # Database schema & migrations
├── docs/                        # Documentation
├── public/                      # Demo web pages
├── docker-compose.yml           # Docker configuration
└── API_DOCUMENTATION.md         # Complete API reference
```

### Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run db:studio` | Open database management UI |
| `npm run wallets:sync` | Update tracked wallet list |

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
2. Server automatically reloads
3. Test using demo pages at `http://localhost:8080`
4. Check logs for any errors

**Updating Configuration:**
- Runtime settings: Use `/config` API endpoint
- Environment variables: Edit `.env` file and restart
- Database schema: Update `prisma/schema.prisma` and run migrations

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

- [API Documentation](API_DOCUMENTATION.md) - Complete REST API and SSE reference
- [Database Migration Guide](docs/DATABASE_MIGRATION_GUIDE.md) - SQLite to PostgreSQL migration
- [Wallet Sync Documentation](docs/WALLET_SYNC.md) - Automated wallet management
- [System Overview](docs/SYSTEM_OVERVIEW.md) - Architecture and design decisions
- [Docker Guide](DOCKER.md) - Container deployment details

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
