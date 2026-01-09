# Helius Whale Wallet Tracker

A production-ready Solana wallet tracking system that processes Helius Enhanced Webhooks to monitor whale transactions and detect coordinated trading patterns.

## Features

- **Real-time Transaction Processing**: Handles Helius webhooks with enhanced parsing for token transfers and native transactions
- **Coordinated Trade Detection**: Identifies coordinated buying patterns across multiple wallets within configurable time windows
- **Real-time Streaming**: Server-Sent Events (SSE) for live transaction and coordination data
- **Production Architecture**: Clean, modular codebase with proper error handling and logging
- **Configurable Filtering**: Exclude specific tokens and set minimum transaction amounts
- **Database Persistence**: SQLite with Prisma ORM for reliable data storage

## Quick Start

### Prerequisites

- Node.js 18+ 
- Docker (optional, for containerized deployment)

### Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd helius-wallet-tracker
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Initialize database**
```bash
npm run db:generate
npm run db:migrate
```

4. **Start development server**
```bash
npm run dev
```

## Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Webhook Security
WEBHOOK_SECRET="your-webhook-secret"

# API Configuration  
PORT=8080
NODE_ENV=production
ALLOWED_ORIGINS="*"
```

### Optional Configuration

```env
# Wallet Sync (Daily auto-update at midnight)
WALLETS_API_ENDPOINT="https://your-api-endpoint.com/top-wallets"

# Transaction Filtering
EXCLUDE_TOKENS="So11111111111111111111111111111111111111112"  # WSOL mint
MIN_AMOUNT=1

# Coordinated Trade Detection
COORDINATED_WINDOW_MINUTES=5
COORDINATED_MIN_WALLETS=5

# Deduplication
DEDUP_BY_SIGNATURE_ONLY=false

# Debug Logging
DEBUG_EVENTS=false
DEBUG_EVENTS_VERBOSE=false
```

## API Endpoints

### Core Endpoints

- **`GET /health`** - Health check endpoint
- **`POST /helius`** - Webhook endpoint for Helius events (requires authentication)
- **`GET /config`** - Get current configuration
- **`PATCH /config`** - Update configuration at runtime

### Real-time Streams

- **`GET /stream/transfers`** - SSE stream for transfer events
- **`GET /stream/coordinated`** - SSE stream for coordinated trade events  
- **`GET /stream/all`** - Combined SSE stream with named events

## Docker Deployment

### Build and run with Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Docker Compose

```bash
# Start with your environment file
docker-compose --env-file .env up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Architecture

```
src/
├── app.ts                 # Application entry point
├── lib/
│   ├── env.ts            # Environment validation
│   └── logger.ts         # Centralized logging
├── middleware/
│   ├── auth.ts           # Authentication middleware
│   └── error.ts          # Error handling
├── controllers/
│   ├── webhook.ts        # Webhook request handlers
│   ├── config.ts         # Configuration management
│   └── health.ts         # Health check
├── services/
│   ├── webhook.ts        # Core webhook processing logic
│   └── coordinator.ts    # Background coordinated trade scanner
├── routes/
│   ├── webhook.ts        # Webhook routing
│   ├── config.ts         # Configuration routing
│   └── health.ts         # Health check routing
├── utils/
│   └── parse.ts          # Helius event parsing
├── config.ts             # Runtime configuration management
├── db.ts                 # Database connection
├── realtime.ts           # SSE streaming functionality
├── types.ts              # TypeScript type definitions
├── verify.ts             # Webhook verification
└── wallets.json          # Tracked wallet addresses
```

## Key Features

### Automated Wallet List Management

The system automatically syncs the top 100 performing wallets daily at midnight:
- Fetches wallet data from a configured API endpoint
- Updates `wallets.json` with the latest addresses
- Runs automatically in the background
- Can be triggered manually with `npm run wallets:sync`

See [Wallet Sync Documentation](docs/WALLET_SYNC.md) for details.

### Coordinated Trade Detection

The system monitors for coordinated buying patterns by:
1. Tracking BUY transactions within sliding time windows
2. Counting unique wallets participating in token purchases
3. Triggering alerts when wallet count exceeds threshold
4. Broadcasting coordinated trade events via SSE

### Real-time Processing

- **Webhook Processing**: Handles Helius enhanced webhooks with proper authentication
- **Event Streaming**: Real-time SSE streams for transfers and coordinated trades
- **Background Scanning**: Continuous monitoring for missed coordination patterns

### Production Features

- **Environment Validation**: Strict validation of all environment variables
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Logging**: Structured logging with configurable debug levels
- **Graceful Shutdown**: Proper cleanup of resources and background processes
- **Health Checks**: Built-in health endpoints for monitoring

## Database Schema

The system uses two main tables:

- **`TransferEvent`**: Individual token transfer records
- **`CoordinatedTrade`**: Detected coordination patterns with wallet lists

## Security

- Webhook signature verification using `x-helius-secret` header
- CORS configuration for cross-origin requests
- Input validation and sanitization
- Non-root user in Docker container

## Monitoring

The application provides several monitoring capabilities:

- Health check endpoint (`/health`)
- Structured logging with timestamps
- Real-time event streaming for observability
- Configurable debug logging levels

## Development

### Project Scripts

```bash
npm run dev           # Start development server with auto-reload
npm run build         # Build TypeScript to JavaScript
npm run start         # Start production server
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Prisma Studio
npm run wallets:sync  # Manually sync wallet list from API
npm run webhook:update # Update Helius webhook configuration
```

### Adding New Features

1. Follow the established architecture patterns
2. Add proper error handling and logging
3. Include TypeScript types
4. Update environment validation if needed
5. Add appropriate tests

## License

This project is licensed under the MIT License.


## Docker Compose

docker-compose down;

docker-compose up --build -d;

docker-compose down; docker-compose up --build -d;

# Tunnel

cd .\Cloudfare; cloudflared tunnel --config .\cloudflared-config run

# Webhook Update

npm run webhook:update

# For Cloudfare in linux

curl -LO https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb

cp /workspaces/wallet-tracker/Cloudfare/c8e67b13-2249-4281-8170-7744ff8fdfa2.json ~/.cloudflared/