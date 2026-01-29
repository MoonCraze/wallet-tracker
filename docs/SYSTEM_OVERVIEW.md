# System Overview

**Project:** Helius Wallet Tracker  
**Component:** Wallet Tracking Module  
**Part of:** Autonomous Trading System  
**Date:** November 5, 2025  
**Version:** v9-production

---

## Table of Contents

1. [Purpose and Role in Autonomous Trading System](#1-purpose-and-role-in-autonomous-trading-system)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Key Components](#3-key-components)
4. [Technology Stack](#4-technology-stack)
5. [Integration Points with Coordinated Trading Module](#5-integration-points-with-coordinated-trading-module)

---

## 1. Purpose and Role in Autonomous Trading System

### 1.1 Primary Purpose

The Helius Wallet Tracker is a specialized microservice responsible for **real-time monitoring and analysis of Solana blockchain wallet activities**. It serves as the **intelligence gathering layer** within a larger autonomous trading system, providing critical data about coordinated trading patterns among whale wallets.

### 1.2 Role in the Trading Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                 AUTONOMOUS TRADING SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐         ┌──────────────────────┐   │
│  │  Wallet Tracking   │────────▶│  Coordinated Trading │   │
│  │     Module         │  Token  │      Module          │   │
│  │  (THIS SYSTEM)     │  Alerts │                      │   │
│  └────────────────────┘         └──────────────────────┘   │
│          │                                │                 │
│          │ Monitors                       │ Executes        │
│          │ Whale Wallets                  │ Trades          │
│          ▼                                ▼                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Solana Blockchain (via Helius API)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Core Responsibilities

1. **Wallet Activity Monitoring**
   - Track a predefined list of whale/influential wallets on Solana
   - Capture all token transfers (SPL tokens and native SOL)
   - Process transactions in real-time via Helius Enhanced Webhooks

2. **Pattern Detection**
   - Identify coordinated buying patterns across multiple wallets
   - Detect when multiple tracked wallets purchase the same token within time windows
   - Alert downstream systems when coordination thresholds are met

3. **Data Broadcasting**
   - Stream transfer events in real-time via Server-Sent Events (SSE)
   - Broadcast coordinated trade alerts with token addresses
   - Provide persistent storage for historical analysis

4. **Integration Support**
   - Output standardized token addresses for the coordinated trading module
   - Maintain API endpoints for configuration and health monitoring
   - Support multiple concurrent client connections

### 1.4 Business Value

- **Early Signal Detection**: Identify potential token movements before market-wide recognition
- **Coordinated Activity Recognition**: Detect organized buying/selling patterns
- **Risk Mitigation**: Filter noise and focus on significant wallet activities
- **Trading Opportunities**: Provide actionable intelligence for autonomous trading decisions

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
                    ┌──────────────────────┐
                    │   Helius Webhook     │
                    │       Service        │
                    └──────────┬───────────┘
                               │ HTTPS POST
                               │ (Enhanced Webhooks)
                               ▼
┌────────────────────────────────────────────────────────────┐
│                    WALLET TRACKER SERVICE                   │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Webhook Receiver Endpoint               │  │
│  │           (Authentication + Validation)              │  │
│  └─────────────────┬───────────────────────────────────┘  │
│                    │                                        │
│                    ▼                                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           Helius Event Parser & Processor            │  │
│  │  • Parse token transfers (SPL & Native SOL)          │  │
│  │  • Identify tracked wallets                          │  │
│  │  • Determine BUY/SELL side                           │  │
│  │  • Filter by token exclusions & min amounts          │  │
│  └─────────────────┬───────────────────────────────────┘  │
│                    │                                        │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│  ┌─────────────┐      ┌─────────────────────────┐         │
│  │ Deduplication│      │   Transfer Storage      │         │
│  │   Engine     │      │   (SQLite + Prisma)     │         │
│  └─────────────┘      └──────────┬──────────────┘         │
│                                   │                         │
│                                   ▼                         │
│         ┌──────────────────────────────────────────┐       │
│         │  Coordinated Trade Detection Engine      │       │
│         │  • Time window bucketing (5 min default) │       │
│         │  • Count unique wallets per token        │       │
│         │  • Trigger alerts on threshold           │       │
│         └──────────┬───────────────────────────────┘       │
│                    │                                        │
│         ┌──────────┴──────────┐                            │
│         ▼                     ▼                            │
│  ┌─────────────┐      ┌─────────────────────────┐         │
│  │   Database  │      │  Real-time Broadcasting │         │
│  │   Storage   │      │      (SSE Streams)       │         │
│  │             │      │  • /stream/transfers     │         │
│  │             │      │  • /stream/coordinated   │         │
│  └─────────────┘      └──────────┬──────────────┘         │
│                                   │                         │
└───────────────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │  Coordinated Trading      │
                    │       Module              │
                    │  (Consumes Token Data)    │
                    └───────────────────────────┘
```

### 2.2 Processing Flow

**Step 1: Webhook Reception**
```
Helius → POST /helius → Verify Signature → Parse Payload
```

**Step 2: Event Processing**
```
Parse Events → Filter Tracked Wallets → Extract Transfers → Deduplicate
```

**Step 3: Storage & Analysis**
```
Save to DB → Check Coordination Patterns → Broadcast Events
```

**Step 4: Real-time Distribution**
```
SSE Streams → Connected Clients → Coordinated Trading Module
```

### 2.3 Data Flow Summary

1. **Input**: Helius Enhanced Webhooks (transaction events)
2. **Processing**: Parse, filter, deduplicate, and analyze
3. **Storage**: SQLite database with indexed queries
4. **Output**: 
   - Real-time SSE broadcasts
   - REST API for queries
   - Token addresses for trading decisions

---

## 3. Key Components

### 3.1 Core Service Components

#### 3.1.1 Webhook Service (`services/webhook.ts`)
- **Purpose**: Process incoming Helius webhook events
- **Functions**:
  - Load tracked wallet list
  - Parse and validate events
  - Deduplicate transfers
  - Detect coordinated trades
  - Broadcast events

#### 3.1.2 Coordinator Service (`services/coordinator.ts`)
- **Purpose**: Background scanning for coordination patterns
- **Functions**:
  - Periodic time window analysis
  - Detect missed coordination patterns
  - Independent of webhook flow
  - Backup detection mechanism

#### 3.1.3 Real-time Service (`realtime.ts`)
- **Purpose**: Manage SSE connections and broadcasting
- **Functions**:
  - Client connection management
  - Event streaming
  - Keep-alive heartbeats
  - CORS handling

### 3.2 Infrastructure Components

#### 3.2.1 Database Layer (`db.ts` + Prisma)
- **Technology**: SQLite with Prisma ORM
- **Models**: TransferEvent, CoordinatedTrade
- **Features**: Automatic migrations, type-safe queries

#### 3.2.2 Configuration Manager (`config.ts`)
- **Purpose**: Runtime configuration management
- **Supports**: Dynamic updates without restart
- **Settings**: Filters, thresholds, debug flags

#### 3.2.3 Parser Utility (`utils/parse.ts`)
- **Purpose**: Parse complex Helius webhook payloads
- **Handles**: Multiple payload formats, edge cases
- **Output**: Standardized transfer objects

### 3.3 API Layer

#### 3.3.1 Routes
- `/health` - Health check endpoint
- `/helius` - Webhook receiver
- `/config` - Configuration management
- `/stream/*` - Real-time event streams

#### 3.3.2 Middleware
- Authentication (webhook signature verification)
- Error handling
- CORS configuration
- JSON parsing

### 3.4 Supporting Components

#### 3.4.1 Logging System (`lib/logger.ts`)
- Structured logging with timestamps
- Multiple log levels (info, warn, error, debug)
- Optional verbose event logging

#### 3.4.2 Environment Validation (`lib/env.ts`)
- Zod-based schema validation
- Type-safe environment variables
- Startup validation

#### 3.4.3 Wallet Registry (`wallets.json`)
- List of tracked wallet addresses
- Loaded at startup
- Easily updatable

---

## 4. Technology Stack

### 4.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime environment |
| **TypeScript** | 5.5.4 | Type-safe development |
| **Express** | 4.19.2 | Web framework |
| **Prisma** | 5.16.1 | Database ORM |
| **SQLite** | - | Database (via Prisma) |
| **Zod** | 3.23.8 | Schema validation |

### 4.2 Key Dependencies

```json
{
  "express": "Web server and API framework",
  "prisma": "Database ORM and migrations",
  "@prisma/client": "Type-safe database client",
  "cors": "Cross-origin resource sharing",
  "dotenv": "Environment variable management",
  "zod": "Runtime type validation",
  "axios": "HTTP client for webhook updates",
  "ws": "WebSocket support (planned)"
}
```

### 4.3 Development Tools

| Tool | Purpose |
|------|---------|
| **tsx** | TypeScript execution with hot reload |
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Cloudflare Tunnel** | Secure webhook exposure |

### 4.4 Infrastructure

```
┌─────────────────────────────────────────────────┐
│            Production Deployment                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐      ┌──────────────────┐    │
│  │   Docker     │──────│  Docker Compose  │    │
│  │  Container   │      │  Orchestration   │    │
│  └──────────────┘      └──────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Cloudflare Tunnel (Webhook Ingress)     │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Volume Mounts (Data Persistence)        │  │
│  │  • /app/data  (SQLite database)          │  │
│  │  • /app/logs  (Event logs)               │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 4.5 Why These Technologies?

**Node.js + TypeScript**
- High-performance event-driven architecture
- Type safety reduces runtime errors
- Rich ecosystem for Solana/blockchain tools

**Express**
- Lightweight and flexible
- Excellent middleware support
- Easy SSE implementation

**SQLite + Prisma**
- Zero-configuration database
- Type-safe queries
- Automatic migrations
- Perfect for single-instance deployment

**Server-Sent Events (SSE)**
- Simpler than WebSockets for one-way communication
- Built-in reconnection
- Standard HTTP/HTTPS (no special firewall rules)

**Docker**
- Consistent deployment environments
- Easy scaling
- Isolated dependencies

---

## 5. Integration Points with Coordinated Trading Module

### 5.1 Primary Integration: Real-time SSE Stream

The wallet tracker broadcasts coordinated trade events that the trading module consumes:

```javascript
// Trading Module Integration Example
const eventSource = new EventSource('http://wallet-tracker:8080/stream/coordinated');

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  // Received coordinated trade alert
  const {
    tokenAddress,        // The token with coordinated activity
    uniqueWalletCount,   // Number of wallets involved
    walletAddresses,     // Array of wallet addresses
    windowStart,         // Time window start (ISO string)
    windowEnd,           // Time window end (ISO string)
    triggeredAt          // When alert was generated (ISO string)
  } = data;
  
  // Trading module can now make decisions based on this token
  console.log(`Coordinated activity detected for token: ${tokenAddress}`);
  console.log(`${uniqueWalletCount} wallets bought within time window`);
  
  // → Execute trading logic here
});
```

### 5.2 Data Contract: Coordinated Trade Event

```typescript
interface CoordinatedTradeEvent {
  tokenAddress: string;          // Solana token mint address
  windowStart: string;            // ISO 8601 timestamp
  windowEnd: string;              // ISO 8601 timestamp
  triggeredAt: string;            // ISO 8601 timestamp
  uniqueWalletCount: number;      // Count of unique wallets
  walletAddresses: string[];      // Array of wallet addresses
}
```

**Example Event:**
```json
{
  "tokenAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "windowStart": "2025-11-05T10:00:00.000Z",
  "windowEnd": "2025-11-05T10:05:00.000Z",
  "triggeredAt": "2025-11-05T10:03:47.123Z",
  "uniqueWalletCount": 8,
  "walletAddresses": [
    "13YTpv3ah9Aym4QpfpDK9MfH9tGmhM4nrDBDfGSBKybo",
    "25CxAp9DM2KnpjwCEePvE6Yex6y7HHGJgsQxyoo9j51L",
    "27hEdTBcXMPS4haZYbqmB95n8GD6XxrJEjQRZxcrKmPw",
    // ... more addresses
  ]
}
```

### 5.3 Alternative Integration: REST API

For systems that prefer polling over streaming:

```bash
# Get recent coordinated trades
GET /dev/db/coordinated?limit=50

# Response:
[
  {
    "id": "clx1234abcd",
    "tokenAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "windowStart": "2025-11-05T10:00:00.000Z",
    "windowEnd": "2025-11-05T10:05:00.000Z",
    "triggeredAt": "2025-11-05T10:03:47.123Z",
    "uniqueWalletCount": 8,
    "walletAddresses": "[\"wallet1\", \"wallet2\", ...]"
  }
]
```

### 5.4 Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Trading System                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────┐         ┌───────────────────┐   │
│  │  Wallet Tracker    │         │  Trading Module   │   │
│  │                    │         │                   │   │
│  │  Port: 8080        │────────▶│  Port: 3000       │   │
│  │                    │   SSE   │                   │   │
│  └────────────────────┘         └───────────────────┘   │
│           │                              │               │
│           │ Webhook Input                │ Trade Output  │
│           ▼                              ▼               │
│  ┌─────────────────┐           ┌──────────────────┐     │
│  │  Helius API     │           │  Solana RPC      │     │
│  └─────────────────┘           └──────────────────┘     │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 5.5 Configuration Coordination

Both modules should share configuration values:

| Setting | Purpose | Typical Value |
|---------|---------|---------------|
| `COORDINATED_WINDOW_MINUTES` | Time window for pattern detection | 5 minutes |
| `COORDINATED_MIN_WALLETS` | Minimum wallets to trigger alert | 3-5 wallets |
| `EXCLUDE_TOKENS` | Tokens to ignore | WSOL, stablecoins |
| `MIN_AMOUNT` | Minimum transaction size | 1 token |

### 5.6 Health Check Integration

The trading module should monitor tracker health:

```bash
GET /health

# Response:
{
  "status": "ok",
  "timestamp": "2025-11-05T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

### 5.7 Deployment Considerations

**Network Configuration:**
- Both services should be on the same Docker network
- Use service names for DNS resolution: `http://helius-tracker:8080`

**Scaling:**
- Wallet tracker: Single instance (SQLite limitation)
- Trading module: Can scale horizontally

**Data Flow:**
- One-way: Wallet Tracker → Trading Module
- No backward dependencies
- Trading module failure doesn't affect tracker

---

## 6. Key Features Summary

### 6.1 Real-time Processing
✅ Process transactions as they occur on Solana  
✅ Sub-second latency from blockchain to alert  
✅ Continuous background scanning for missed patterns  

### 6.2 Intelligent Filtering
✅ Track only relevant wallets (whale/influential)  
✅ Exclude noise tokens (WSOL, stablecoins)  
✅ Minimum transaction amounts  
✅ Configurable thresholds  

### 6.3 Pattern Detection
✅ Time-windowed coordination analysis  
✅ Unique wallet counting  
✅ BUY-side focus  
✅ Deduplication to prevent false alerts  

### 6.4 Production-Ready
✅ Docker containerization  
✅ Health monitoring  
✅ Graceful shutdown  
✅ Error recovery  
✅ Structured logging  

### 6.5 Developer-Friendly
✅ TypeScript for type safety  
✅ Hot reload in development  
✅ Clear error messages  
✅ Comprehensive documentation  

---

## 7. Operational Metrics

### 7.1 Performance Characteristics

| Metric | Value |
|--------|-------|
| **Webhook Processing** | < 100ms per event |
| **Database Writes** | Batch inserts, ~1000/sec |
| **SSE Broadcast Latency** | < 50ms |
| **Memory Usage** | ~150-300 MB |
| **CPU Usage (Idle)** | < 5% |
| **CPU Usage (Active)** | 10-30% |

### 7.2 Capacity Limits

| Resource | Limit |
|----------|-------|
| **Tracked Wallets** | 100 wallets (current) |
| **Concurrent SSE Clients** | 100+ connections |
| **Webhook Throughput** | 1000 events/minute |
| **Database Size** | Grows ~1GB/month (estimate) |

### 7.3 Reliability

- **Uptime Target**: 99.9%
- **Data Persistence**: SQLite with volume mounts
- **Failure Recovery**: Automatic restart via Docker
- **Backup Detection**: Background coordinator as fallback

---

## Next Steps

After understanding this system overview, proceed to:

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architectural patterns and design decisions
2. **[COORDINATED_TRADE_DETECTION.md](./COORDINATED_TRADE_DETECTION.md)** - Deep dive into the detection algorithm
3. **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Step-by-step integration instructions
4. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide

---

**Document Version**: 1.0  
**Last Updated**: November 5, 2025  
**Author**: System Documentation  
**Status**: Production Ready
