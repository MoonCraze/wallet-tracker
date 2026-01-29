# Architecture Documentation

**Project:** Helius Wallet Tracker  
**Component:** Wallet Tracking Module  
**Date:** November 5, 2025  
**Version:** v9-production

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Application Structure](#2-application-structure)
3. [Directory Organization](#3-directory-organization)
4. [Design Patterns](#4-design-patterns)
5. [Dependency Graph](#5-dependency-graph)
6. [Data Flow Diagrams](#6-data-flow-diagrams)

---

## 1. High-Level Architecture

### 1.1 Architectural Style

The system follows a **layered microservice architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  (HTTP Routes, SSE Streams, Middleware)                 │
├─────────────────────────────────────────────────────────┤
│                    CONTROLLER LAYER                      │
│  (Request Handlers, Response Formatting)                │
├─────────────────────────────────────────────────────────┤
│                     SERVICE LAYER                        │
│  (Business Logic, Coordination Detection)               │
├─────────────────────────────────────────────────────────┤
│                      UTILITY LAYER                       │
│  (Parsing, Validation, Configuration)                   │
├─────────────────────────────────────────────────────────┤
│                    DATA ACCESS LAYER                     │
│  (Prisma ORM, Database Queries)                         │
├─────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                   │
│  (SQLite Database, File System, Environment)            │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Architectural Principles

#### 1.2.1 Single Responsibility
Each component has one clear purpose:
- **Routes**: Handle HTTP routing only
- **Controllers**: Process requests and format responses
- **Services**: Implement business logic
- **Utilities**: Provide helper functions

#### 1.2.2 Dependency Injection
Services and dependencies are injected, not hard-coded:
```typescript
// WebhookService receives tracked wallets as dependency
class WebhookService {
  constructor(private wallets: Set<string>) {}
}
```

#### 1.2.3 Separation of Concerns
- **Business logic** (services) is independent of HTTP layer
- **Database queries** are abstracted through Prisma
- **Configuration** is centralized and runtime-updateable

#### 1.2.4 Fail-Safe Design
- Graceful error handling at all layers
- Fallback mechanisms (background scanner)
- Non-blocking operations for broadcasts

### 1.3 Component Interaction Model

```
┌──────────────┐
│  HTTP Client │
└──────┬───────┘
       │ Request
       ▼
┌─────────────────────────────────────┐
│          Express Router             │
│  ┌──────────────────────────────┐  │
│  │   Middleware Pipeline        │  │
│  │  • CORS                      │  │
│  │  • Authentication            │  │
│  │  • JSON Parser               │  │
│  └──────────────────────────────┘  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Controller                  │
│  • Validate input                   │
│  • Call service                     │
│  • Format response                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│          Service Layer              │
│  • Business logic                   │
│  • Data transformation              │
│  • Call database                    │
│  • Trigger broadcasts               │
└─────────────┬───────────────────────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌──────────────┐
│  Database   │  │  Real-time   │
│   (Prisma)  │  │ Broadcasting │
└─────────────┘  └──────────────┘
```

---

## 2. Application Structure

### 2.1 Entry Point Flow

**File**: `src/app.ts`

```typescript
// 1. Environment Validation
validateEnv() → Ensure all required variables exist

// 2. Express App Setup
createExpress() → Configure middleware, CORS

// 3. Route Registration
app.use(healthRoutes)
app.use(configRoutes)
app.use(webhookRoutes)

// 4. HTTP Server Creation
createServer(app)

// 5. Real-time Initialization
initRealtime(app, server) → Setup SSE streams

// 6. Background Services
coordinator.start() → Start coordination scanner

// 7. Server Start
server.listen(PORT)

// 8. Graceful Shutdown Handlers
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
```

### 2.2 Request Processing Pipeline

#### 2.2.1 Webhook Request Flow

```
POST /helius
    │
    ├─▶ CORS Middleware
    │       └─▶ Allow configured origins
    │
    ├─▶ JSON Parser Middleware
    │       └─▶ Parse request body (max 10MB)
    │
    ├─▶ Authentication Middleware
    │       └─▶ Verify x-helius-secret header
    │
    ├─▶ Webhook Controller
    │       ├─▶ Extract body and headers
    │       └─▶ Call WebhookService.processWebhook()
    │
    ├─▶ Webhook Service
    │       ├─▶ Log events (if debug enabled)
    │       ├─▶ Parse Helius events
    │       ├─▶ Filter by tracked wallets
    │       ├─▶ Deduplicate transfers
    │       ├─▶ Save to database
    │       ├─▶ Broadcast to SSE clients
    │       └─▶ Check for coordination
    │
    └─▶ Response
            └─▶ { processed: N }
```

#### 2.2.2 SSE Stream Connection Flow

```
GET /stream/coordinated
    │
    ├─▶ CORS Middleware
    │
    ├─▶ Route Handler
    │       ├─▶ Setup SSE headers
    │       │   ├─ Content-Type: text/event-stream
    │       │   ├─ Cache-Control: no-cache
    │       │   └─ Connection: keep-alive
    │       │
    │       ├─▶ Add client to subscriber list
    │       ├─▶ Start keep-alive heartbeat
    │       └─▶ Keep connection open
    │
    └─▶ On coordinated trade detected:
            └─▶ Broadcast to all subscribers
```

### 2.3 Background Process Architecture

```
┌─────────────────────────────────────────────────┐
│        CoordinatedTradeScanner                   │
│                                                  │
│  Interval: ~30 seconds (adaptive)               │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  1. Calculate Current Time Window        │  │
│  │     └─▶ Floor to window boundary         │  │
│  └───────────────────────────────────────────┘  │
│                    │                             │
│                    ▼                             │
│  ┌───────────────────────────────────────────┐  │
│  │  2. Query Tokens with BUY Activity       │  │
│  │     └─▶ SELECT DISTINCT tokenAddress     │  │
│  └───────────────────────────────────────────┘  │
│                    │                             │
│                    ▼                             │
│  ┌───────────────────────────────────────────┐  │
│  │  3. For Each Token:                      │  │
│  │     a. Check if already processed        │  │
│  │     b. Count unique wallet buyers        │  │
│  │     c. If >= threshold, create alert     │  │
│  │     d. Broadcast coordination event      │  │
│  └───────────────────────────────────────────┘  │
│                    │                             │
│                    ▼                             │
│  ┌───────────────────────────────────────────┐  │
│  │  4. Schedule Next Scan                   │  │
│  │     └─▶ setTimeout(scan, intervalMs)     │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 3. Directory Organization

### 3.1 Project Structure

```
helius-wallet-tracker/
│
├── src/                          # Source code
│   ├── app.ts                    # Application entry point
│   ├── config.ts                 # Runtime configuration manager
│   ├── db.ts                     # Database connection (Prisma)
│   ├── realtime.ts               # SSE implementation
│   ├── types.ts                  # TypeScript type definitions
│   ├── verify.ts                 # Webhook signature verification
│   ├── wallets.json              # Tracked wallet addresses
│   │
│   ├── controllers/              # Request handlers
│   │   ├── config.ts             # Configuration endpoints
│   │   ├── health.ts             # Health check handler
│   │   └── webhook.ts            # Webhook processing handler
│   │
│   ├── lib/                      # Core libraries
│   │   ├── env.ts                # Environment validation (Zod)
│   │   └── logger.ts             # Structured logging
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts               # Authentication middleware
│   │   └── error.ts              # Error handling middleware
│   │
│   ├── routes/                   # Route definitions
│   │   ├── config.ts             # Config routes
│   │   ├── health.ts             # Health routes
│   │   └── webhook.ts            # Webhook routes
│   │
│   ├── services/                 # Business logic
│   │   ├── coordinator.ts        # Coordination scanner service
│   │   └── webhook.ts            # Webhook processing service
│   │
│   └── utils/                    # Utility functions
│       └── parse.ts              # Helius event parser
│
├── prisma/                       # Database schema & migrations
│   ├── schema.prisma             # Prisma schema definition
│   └── migrations/               # Database migrations
│       └── [timestamp]_init/     # Migration files
│
├── logs/                         # Application logs
│   └── events.ndjson             # Webhook event logs (debug)
│
├── Cloudfare/                    # Tunnel configuration
│   └── cloudflared-config.yml    # Cloudflare tunnel config
│
├── scripts/                      # Utility scripts
│   └── updateWebhook.ts          # Helius webhook updater
│
├── public/                       # Static files (for testing)
│   ├── coordinated-trades-live.html
│   ├── realtime-test.html
│   └── test.html
│
├── .env                          # Environment variables (local)
├── .env.production               # Production environment
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── Dockerfile                    # Container build instructions
├── docker-compose.yml            # Multi-container setup
└── README.md                     # Project documentation
```

### 3.2 Module Relationships

```
app.ts (Entry Point)
├── lib/env.ts (Environment)
├── lib/logger.ts (Logging)
├── middleware/
│   ├── auth.ts → verify.ts
│   └── error.ts → lib/logger.ts
├── routes/
│   ├── health.ts → controllers/health.ts
│   ├── config.ts → controllers/config.ts
│   └── webhook.ts → controllers/webhook.ts → middleware/auth.ts
├── controllers/
│   ├── webhook.ts → services/webhook.ts
│   └── config.ts → config.ts
├── services/
│   ├── webhook.ts
│   │   ├── utils/parse.ts
│   │   ├── config.ts
│   │   ├── db.ts
│   │   └── realtime.ts
│   └── coordinator.ts
│       ├── db.ts
│       ├── config.ts
│       └── realtime.ts
└── realtime.ts
```

### 3.3 File Responsibility Matrix

| File | Lines | Responsibility | Dependencies |
|------|-------|----------------|--------------|
| `app.ts` | ~150 | Application bootstrap, server lifecycle | All routes, middleware |
| `config.ts` | ~80 | Runtime configuration management | Zod |
| `db.ts` | ~10 | Database connection singleton | Prisma |
| `realtime.ts` | ~120 | SSE client management | Express |
| `verify.ts` | ~30 | Webhook signature verification | Crypto |
| `types.ts` | ~15 | Type definitions | None |
| `services/webhook.ts` | ~300 | Core webhook processing logic | Parse, DB, Realtime |
| `services/coordinator.ts` | ~120 | Background coordination scanner | DB, Realtime |
| `utils/parse.ts` | ~350 | Helius event parsing | Zod, Crypto |
| `middleware/auth.ts` | ~30 | Request authentication | Verify |
| `middleware/error.ts` | ~50 | Error handling | Logger |
| `controllers/webhook.ts` | ~40 | Webhook request handler | Webhook service |
| `routes/webhook.ts` | ~20 | Webhook routing | Controller, Middleware |

---

## 4. Design Patterns

### 4.1 Singleton Pattern

**Used For**: Database connection, configuration

```typescript
// db.ts - Database Singleton
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
// Single instance shared across application
```

**Benefits**:
- Single database connection pool
- Consistent state across requests
- Efficient resource usage

### 4.2 Service Pattern

**Used For**: Business logic encapsulation

```typescript
// services/webhook.ts
export class WebhookService {
  private wallets: Set<string>;
  
  constructor() {
    // Load dependencies
    this.wallets = new Set(loadWallets());
  }
  
  async processWebhook(body: any, headers: any) {
    // Encapsulated business logic
  }
}
```

**Benefits**:
- Testable business logic
- Reusable across different controllers
- Clear separation from HTTP layer

### 4.3 Middleware Pipeline Pattern

**Used For**: Request processing chain

```typescript
// app.ts
app.use(cors(corsOptions));           // 1. CORS
app.use('/helius', express.json());   // 2. Body parser
app.use(webhookRoutes);               // 3. Route handlers
app.use(notFoundHandler);             // 4. 404 handler
app.use(errorHandler);                // 5. Error handler
```

**Benefits**:
- Modular request processing
- Easy to add/remove features
- Clear execution order

### 4.4 Observer Pattern (Pub/Sub)

**Used For**: Real-time event broadcasting

```typescript
// Publisher (Webhook Service)
publishTransfers(transferData);
publishCoordinated(coordinationData);

// Subscribers (SSE Clients)
const transfersClients = new Set<Response>();
for (const client of transfersClients) {
  client.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

**Benefits**:
- Loose coupling between producers and consumers
- Multiple subscribers
- Non-blocking broadcasts

### 4.5 Strategy Pattern

**Used For**: Configuration-based behavior

```typescript
// Deduplication strategy based on config
const key = config.dedupBySignatureOnly 
  ? transfer.signature 
  : `${transfer.walletAddress}|${transfer.tokenAddress}|${transfer.signature}`;
```

**Benefits**:
- Runtime behavior changes
- No code changes for config updates
- Easy A/B testing

### 4.6 Factory Pattern

**Used For**: Object creation with validation

```typescript
// Environment factory with validation
export function validateEnv(): Env {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    console.error("Invalid environment");
    process.exit(1);
  }
}
```

**Benefits**:
- Guaranteed valid objects
- Centralized validation
- Type safety

### 4.7 Repository Pattern

**Used For**: Data access abstraction

```typescript
// Prisma abstracts database operations
await prisma.transferEvent.create({ data: {...} });
await prisma.coordinatedTrade.findMany({ where: {...} });
```

**Benefits**:
- Database-agnostic code
- Easy to mock for testing
- Type-safe queries

---

## 5. Dependency Graph

### 5.1 Core Dependencies

```
┌─────────────┐
│   app.ts    │
└──────┬──────┘
       │
       ├─────▶ lib/env.ts ────▶ zod
       │
       ├─────▶ middleware/
       │       ├─▶ auth.ts ────▶ verify.ts ────▶ crypto
       │       ├─▶ error.ts ───▶ lib/logger.ts
       │       └─▶ cors
       │
       ├─────▶ routes/
       │       ├─▶ health.ts ──▶ controllers/health.ts
       │       ├─▶ config.ts ──▶ controllers/config.ts ──▶ config.ts
       │       └─▶ webhook.ts ─▶ controllers/webhook.ts
       │                              │
       │                              ▼
       │                        services/webhook.ts
       │                              │
       │                              ├─▶ utils/parse.ts
       │                              ├─▶ db.ts ─▶ @prisma/client
       │                              ├─▶ config.ts
       │                              └─▶ realtime.ts
       │
       ├─────▶ realtime.ts ───▶ express
       │
       └─────▶ services/coordinator.ts
                     │
                     ├─▶ db.ts
                     ├─▶ config.ts
                     └─▶ realtime.ts
```

### 5.2 External Dependencies

```
Production Dependencies:
┌──────────────────────────────────────┐
│ @prisma/client ────▶ SQLite          │
│ express ────▶ HTTP Server            │
│ cors ────▶ CORS Handling             │
│ dotenv ────▶ Environment Variables   │
│ zod ────▶ Schema Validation          │
│ axios ────▶ HTTP Client              │
│ ws ────▶ WebSocket (planned)         │
└──────────────────────────────────────┘

Development Dependencies:
┌──────────────────────────────────────┐
│ tsx ────▶ TypeScript Execution       │
│ typescript ────▶ Type Checking       │
│ prisma ────▶ Database Migrations     │
│ @types/* ────▶ Type Definitions      │
└──────────────────────────────────────┘
```

### 5.3 Circular Dependency Prevention

**No circular dependencies exist**. The dependency flow is strictly hierarchical:

```
Entry → Middleware → Routes → Controllers → Services → Utilities → Database
```

**Shared modules** (like `config.ts`, `db.ts`, `realtime.ts`) are:
- Singletons or stateless
- Have no dependencies on higher layers
- Can be safely imported anywhere

---

## 6. Data Flow Diagrams

### 6.1 Webhook Processing Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK PROCESSING FLOW                       │
└─────────────────────────────────────────────────────────────────┘

Helius API
    │
    │ POST /helius (Enhanced Webhook)
    │ Headers: x-helius-secret, content-type
    │ Body: [transaction_events]
    ▼
┌────────────────────────────────────┐
│  1. Express Middleware Pipeline    │
│     • CORS Check                   │
│     • JSON Parser (10MB limit)     │
│     • Signature Verification       │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  2. Webhook Controller             │
│     • Extract body & headers       │
│     • Call WebhookService          │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  3. WebhookService.processWebhook  │
│     ┌──────────────────────────┐   │
│     │ a. Log Events (Optional) │   │
│     └──────────┬───────────────┘   │
│                ▼                    │
│     ┌──────────────────────────┐   │
│     │ b. Parse Helius Events   │   │
│     │    • parseHeliusEvent()  │   │
│     │    • Extract transfers   │   │
│     │    • Match wallets       │   │
│     └──────────┬───────────────┘   │
│                ▼                    │
│     ┌──────────────────────────┐   │
│     │ c. Deduplicate Transfers │   │
│     │    • Filter exclusions   │   │
│     │    • Check min amounts   │   │
│     │    • Remove duplicates   │   │
│     └──────────┬───────────────┘   │
│                ▼                    │
│     ┌──────────────────────────┐   │
│     │ d. Save to Database      │   │
│     │    • Batch insert        │   │
│     │    • Handle conflicts    │   │
│     └──────────┬───────────────┘   │
│                ▼                    │
│     ┌──────────────────────────┐   │
│     │ e. Broadcast Transfers   │   │
│     │    • publishTransfers()  │   │
│     │    • SSE to clients      │   │
│     └──────────┬───────────────┘   │
│                ▼                    │
│     ┌──────────────────────────┐   │
│     │ f. Check Coordination    │   │
│     │    • Identify BUY tokens │   │
│     │    • Count wallets       │   │
│     │    • Trigger alerts      │   │
│     └──────────┬───────────────┘   │
└────────────────┼────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│   Database   │   │  SSE Broadcast   │
│  (Persisted) │   │  (Real-time)     │
└──────────────┘   └──────────────────┘
                           │
                           ▼
                   ┌─────────────────┐
                   │ Trading Module  │
                   │  (Consumes)     │
                   └─────────────────┘
```

### 6.2 Coordination Detection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               COORDINATED TRADE DETECTION FLOW                   │
└─────────────────────────────────────────────────────────────────┘

Trigger: New BUY transfer saved OR Background scan timer
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│  1. Calculate Time Window                                  │
│     currentTime = new Date()                               │
│     windowStart = floor(currentTime, windowMinutes)        │
│     windowEnd = windowStart + windowMinutes                │
│                                                             │
│     Example: Current = 10:03:47                            │
│              Window  = 10:00:00 - 10:05:00                 │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  2. Query Tokens with BUY Activity                         │
│     SELECT DISTINCT tokenAddress                           │
│     FROM TransferEvent                                     │
│     WHERE side = 'BUY'                                     │
│       AND timestamp >= windowStart                         │
│       AND timestamp < currentTime                          │
│       AND tokenAddress NOT IN excludedTokens               │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│  3. For Each Token: Count Unique Wallets                   │
│     ┌──────────────────────────────────────────────────┐  │
│     │ a. Check if already processed                    │  │
│     │    SELECT * FROM CoordinatedTrade                │  │
│     │    WHERE tokenAddress = token                    │  │
│     │      AND windowStart = window                    │  │
│     │                                                   │  │
│     │    If exists → Skip (already alerted)            │  │
│     └──────────────────┬───────────────────────────────┘  │
│                        ▼                                   │
│     ┌──────────────────────────────────────────────────┐  │
│     │ b. Count unique buying wallets                   │  │
│     │    SELECT DISTINCT walletAddress                 │  │
│     │    FROM TransferEvent                            │  │
│     │    WHERE tokenAddress = token                    │  │
│     │      AND side = 'BUY'                            │  │
│     │      AND timestamp BETWEEN windowStart, current  │  │
│     │                                                   │  │
│     │    uniqueWallets = results.length                │  │
│     └──────────────────┬───────────────────────────────┘  │
│                        ▼                                   │
│     ┌──────────────────────────────────────────────────┐  │
│     │ c. Compare with threshold                        │  │
│     │    IF uniqueWallets >= COORDINATED_MIN_WALLETS   │  │
│     │    THEN:                                         │  │
│     │       • Create CoordinatedTrade record           │  │
│     │       • Broadcast alert via SSE                  │  │
│     │       • Log coordination event                   │  │
│     └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │   SSE Stream  │
                   │  /coordinated │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │    Trading    │
                   │    Module     │
                   └───────────────┘
```

### 6.3 Real-time Broadcast Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   REAL-TIME BROADCAST FLOW                       │
└─────────────────────────────────────────────────────────────────┘

Event Source: WebhookService OR CoordinatorService
    │
    ▼
┌──────────────────────────────────────┐
│  publishTransfers(data) OR           │
│  publishCoordinated(data)            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Realtime Module                     │
│  ┌────────────────────────────────┐  │
│  │ Get Active Client List         │  │
│  │  • transfersClients            │  │
│  │  • coordinatedClients          │  │
│  │  • allClients (combined)       │  │
│  └────────────┬───────────────────┘  │
│               ▼                       │
│  ┌────────────────────────────────┐  │
│  │ Format SSE Message             │  │
│  │  data: {JSON payload}\n\n      │  │
│  │  OR                             │  │
│  │  event: transfers\n            │  │
│  │  data: {JSON payload}\n\n      │  │
│  └────────────┬───────────────────┘  │
│               ▼                       │
│  ┌────────────────────────────────┐  │
│  │ Iterate Over Clients           │  │
│  │  FOR each client in list:      │  │
│  │    TRY:                         │  │
│  │      res.write(sseMessage)     │  │
│  │    CATCH error:                 │  │
│  │      Remove client from list   │  │
│  │      Close connection           │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Connected Clients (HTTP Streams)    │
│  ┌────────────────────────────────┐  │
│  │  Client 1: Browser EventSource │  │
│  │  Client 2: Trading Module SSE  │  │
│  │  Client 3: Monitoring Dashboard│  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 6.4 Configuration Update Flow

```
┌────────────────────────────────────────────────────────┐
│               CONFIGURATION UPDATE FLOW                 │
└────────────────────────────────────────────────────────┘

Admin/Operator
    │
    │ PATCH /config
    │ Body: { "coordinatedMinWallets": 10 }
    ▼
┌────────────────────────────────────┐
│  Config Controller                 │
│  • Validate patch object           │
│  • Call setConfig()                │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  config.ts Module                  │
│  ┌──────────────────────────────┐  │
│  │ 1. Merge with current config │  │
│  │    merged = {...CONFIG, ...} │  │
│  └──────────────┬───────────────┘  │
│                 ▼                   │
│  ┌──────────────────────────────┐  │
│  │ 2. Validate with Zod schema  │  │
│  │    ConfigSchema.parse(...)   │  │
│  └──────────────┬───────────────┘  │
│                 ▼                   │
│  ┌──────────────────────────────┐  │
│  │ 3. Update global CONFIG      │  │
│  │    CONFIG = newConfig        │  │
│  └──────────────┬───────────────┘  │
│                 ▼                   │
│  ┌──────────────────────────────┐  │
│  │ 4. Return updated config     │  │
│  └──────────────────────────────┘  │
└────────────────┬────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  All Services  │
        │  Use getConfig()│
        │  for new values │
        └────────────────┘
```

### 6.5 Database Access Flow

```
┌────────────────────────────────────────────────────────┐
│                  DATABASE ACCESS FLOW                   │
└────────────────────────────────────────────────────────┘

Service Layer (WebhookService, CoordinatorService)
    │
    │ Prisma Query (Type-safe)
    ▼
┌────────────────────────────────────┐
│  Prisma Client (@prisma/client)    │
│  • Validates query at compile-time │
│  • Generates SQL                   │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  Prisma Engine                     │
│  • Translates to SQL dialect       │
│  • Connection pooling              │
│  • Query optimization              │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  SQLite Database                   │
│  • File: data/production.db        │
│  • Tables: TransferEvent,          │
│            CoordinatedTrade        │
└────────────────────────────────────┘
```

---

## 7. Performance Considerations

### 7.1 Database Indexing Strategy

```sql
-- TransferEvent indexes (from schema.prisma)
@@index([walletAddress, timestamp])  -- For wallet history queries
@@index([tokenAddress, timestamp])   -- For token activity queries
@@index([signature])                 -- For deduplication

-- CoordinatedTrade indexes
@@index([tokenAddress, windowStart]) -- For coordination queries
@@unique([tokenAddress, windowStart]) -- Prevent duplicate alerts
```

### 7.2 Query Optimization

**Batch Inserts**:
```typescript
// Efficient: Single query for multiple records
await prisma.transferEvent.createMany({
  data: [transfer1, transfer2, ...transferN]
});

// Inefficient: N queries
for (const transfer of transfers) {
  await prisma.transferEvent.create({ data: transfer });
}
```

**Selective Queries**:
```typescript
// Only select needed fields
await prisma.coordinatedTrade.findFirst({
  where: { tokenAddress, windowStart },
  select: { id: true }  // Don't fetch full record
});
```

### 7.3 Memory Management

**SSE Client Cleanup**:
```typescript
// Automatic cleanup on disconnect
req.on('close', () => {
  clients.delete(res);
  clearInterval(heartbeat);
  res.end();
});
```

**Deduplication Sets**:
```typescript
// Clear after processing each webhook batch
const uniqueMap = new Map();
// ... process ...
uniqueMap.clear(); // Eligible for GC
```

### 7.4 Concurrency Model

```
┌────────────────────────────────────────────┐
│         Node.js Event Loop                  │
├────────────────────────────────────────────┤
│                                             │
│  Main Thread (Non-blocking):               │
│  • HTTP request handling                   │
│  • JSON parsing                            │
│  • Database queries (async)                │
│  • SSE broadcasts                          │
│                                             │
│  Background Timer:                         │
│  • CoordinatorScanner (setTimeout)         │
│                                             │
└────────────────────────────────────────────┘
```

**No blocking operations**: All I/O is asynchronous

---

## 8. Scalability Considerations

### 8.1 Current Limitations

| Component | Limitation | Reason |
|-----------|------------|--------|
| **Database** | Single instance | SQLite file-based |
| **SSE Broadcasting** | Single process | In-memory client list |
| **Coordination Scanner** | Single timer | No distributed coordination |

### 8.2 Horizontal Scaling Path

To scale horizontally (future):

```
┌─────────────────────────────────────────────────────────┐
│                  SCALED ARCHITECTURE                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Load Balancer (Sticky Sessions for SSE)                │
│       │                                                  │
│       ├─▶ Instance 1 ─┐                                 │
│       ├─▶ Instance 2 ─┤─▶ PostgreSQL (Shared)          │
│       └─▶ Instance 3 ─┘                                 │
│                        │                                 │
│                        └─▶ Redis Pub/Sub (Broadcasts)   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Changes required:
1. Replace SQLite with PostgreSQL
2. Use Redis for SSE broadcast coordination
3. Implement distributed locking for coordinator
4. Sticky sessions for SSE clients

---

## 9. Security Architecture

### 9.1 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Network Security                              │
│  └─▶ Cloudflare Tunnel (HTTPS only)                     │
│                                                          │
│  Layer 2: Request Validation                            │
│  └─▶ Webhook Signature Verification (x-helius-secret)   │
│                                                          │
│  Layer 3: CORS Policy                                   │
│  └─▶ Configured allowed origins                         │
│                                                          │
│  Layer 4: Input Validation                              │
│  └─▶ Zod schema validation                              │
│                                                          │
│  Layer 5: Container Isolation                           │
│  └─▶ Non-root user in Docker                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Data Security

- **Secrets**: Environment variables only
- **Database**: File permissions (container user only)
- **Logs**: No sensitive data logged
- **Network**: All connections over HTTPS

---

## 10. Error Handling Architecture

### 10.1 Error Propagation

```
Error Occurs
    │
    ├─▶ Try/Catch in Service Layer
    │       └─▶ Log error → Continue processing
    │
    ├─▶ Catch in Controller Layer
    │       └─▶ Return HTTP error response
    │
    └─▶ Global Error Handler Middleware
            └─▶ Log + Return 500
```

### 10.2 Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Database error | Log warning, continue with other events |
| SSE broadcast fails | Remove dead client, continue |
| Webhook verification fails | Return 401, reject request |
| Parse error | Log error, skip malformed event |

---

## Next Steps

After understanding the architecture, proceed to:

1. **[CORE_COMPONENTS.md](./CORE_COMPONENTS.md)** - Detailed component documentation
2. **[SERVICES.md](./SERVICES.md)** - Service layer deep dive
3. **[DATA_PROCESSING.md](./DATA_PROCESSING.md)** - Data transformation pipeline

---

**Document Version**: 1.0  
**Last Updated**: November 5, 2025  
**Author**: System Documentation  
**Status**: Production Ready
