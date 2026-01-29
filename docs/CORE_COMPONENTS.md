# Core Components Documentation

**Project:** Helius Wallet Tracker  
**Component:** Core Application Components  
**Date:** November 8, 2025  
**Version:** v9-production

---

## Table of Contents

1. [Application Entry Point (app.ts)](#1-application-entry-point-appts)
2. [Configuration Management (config.ts)](#2-configuration-management-configts)
3. [Database Layer (db.ts)](#3-database-layer-dbts)
4. [Real-time Streaming (realtime.ts)](#4-real-time-streaming-realtimets)
5. [Webhook Verification (verify.ts)](#5-webhook-verification-verifyts)
6. [Type Definitions (types.ts)](#6-type-definitions-typests)

---

## 1. Application Entry Point (app.ts)

**File**: `src/app.ts`  
**Lines of Code**: ~150  
**Purpose**: Bootstrap and orchestrate the entire application

### 1.1 Overview

The entry point is responsible for:
- Environment validation and setup
- Express application configuration
- Middleware registration
- Route mounting
- Real-time features initialization
- Background services startup
- Graceful shutdown handling

### 1.2 Code Structure

```typescript
// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { validateEnv, getEnv } from "./lib/env.js";
import { Logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { initRealtime } from "./realtime.js";
import { CoordinatedTradeScanner } from "./services/coordinator.js";
import { webhookRoutes } from "./routes/webhook.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";

// 1. ENVIRONMENT VALIDATION
const env = validateEnv();

// 2. EXPRESS APP CREATION
const app = express();

// 3. CORS CONFIGURATION
const corsOptions = {
  origin: (origin, callback) => {
    if (env.ALLOWED_ORIGINS === '*') {
      return callback(null, true);
    }
    
    if (env.ALLOWED_ORIGINS) {
      const origins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      if (origins.includes(origin || '') || !origin) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    }
    
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-helius-secret'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 4. JSON PARSING (Route-specific)
app.use('/helius', express.json({ 
  limit: "10mb", 
  type: ["application/json", "application/*+json"] 
}));

app.use('/config', express.json());

// 5. ROUTE REGISTRATION
app.use(healthRoutes);
app.use(configRoutes);
app.use(webhookRoutes);

// 6. DEVELOPMENT ENDPOINTS (Optional)
if (env.ALLOW_DEV_ENDPOINTS) {
  // Database query endpoints for debugging
  app.get('/dev/db/transfers', async (req, res) => { /* ... */ });
  app.get('/dev/db/coordinated', async (req, res) => { /* ... */ });
  app.get('/dev/db/stats', async (req, res) => { /* ... */ });
}

// 7. HTTP SERVER CREATION
const server = createServer(app);

// 8. REALTIME INITIALIZATION
initRealtime(app, server);

// 9. ERROR HANDLING (Must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// 10. BACKGROUND SERVICES
const coordinator = new CoordinatedTradeScanner();

// 11. GRACEFUL SHUTDOWN
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, shutting down gracefully');
  coordinator.stop();
  server.close(() => {
    Logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, shutting down gracefully');
  coordinator.stop();
  server.close(() => {
    Logger.info('Server closed');
    process.exit(0);
  });
});

// 12. SERVER START
server.listen(env.PORT, () => {
  Logger.info(`🚀 Server started on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    allowDevEndpoints: env.ALLOW_DEV_ENDPOINTS,
    coordinatedWindowMinutes: env.COORDINATED_WINDOW_MINUTES,
    coordinatedMinWallets: env.COORDINATED_MIN_WALLETS
  });

  coordinator.start();
});
```

### 1.3 Initialization Flow

```
┌─────────────────────────────────────────────────────────┐
│              APPLICATION INITIALIZATION                  │
└─────────────────────────────────────────────────────────┘

START
  │
  ├─▶ 1. Load .env file (dotenv)
  │      └─▶ Parse environment variables
  │
  ├─▶ 2. Validate environment (lib/env.ts)
  │      ├─▶ Check required variables
  │      ├─▶ Validate types and formats
  │      └─▶ Exit if invalid
  │
  ├─▶ 3. Create Express app
  │      └─▶ Initialize web framework
  │
  ├─▶ 4. Configure CORS
  │      ├─▶ Parse allowed origins
  │      └─▶ Set up CORS middleware
  │
  ├─▶ 5. Register JSON parsers
  │      ├─▶ /helius → 10MB limit
  │      └─▶ /config → Default limit
  │
  ├─▶ 6. Mount routes
  │      ├─▶ /health (Health check)
  │      ├─▶ /config (Configuration API)
  │      └─▶ /helius (Webhook receiver)
  │
  ├─▶ 7. Register dev endpoints (if enabled)
  │      ├─▶ /dev/db/transfers
  │      ├─▶ /dev/db/coordinated
  │      └─▶ /dev/db/stats
  │
  ├─▶ 8. Create HTTP server
  │      └─▶ Wrap Express app
  │
  ├─▶ 9. Initialize real-time features
  │      ├─▶ Setup SSE endpoints
  │      └─▶ Initialize client lists
  │
  ├─▶ 10. Register error handlers
  │       ├─▶ 404 Not Found handler
  │       └─▶ Global error handler
  │
  ├─▶ 11. Start background services
  │       └─▶ Coordinated trade scanner
  │
  ├─▶ 12. Register shutdown handlers
  │       ├─▶ SIGINT handler
  │       └─▶ SIGTERM handler
  │
  └─▶ 13. Listen on port
         ├─▶ Log startup message
         └─▶ Application READY
```

### 1.4 CORS Configuration Details

The CORS implementation supports flexible origin control:

```typescript
// Example configurations:

// 1. Allow all origins (development)
ALLOWED_ORIGINS="*"

// 2. Single origin
ALLOWED_ORIGINS="https://trading-dashboard.example.com"

// 3. Multiple origins (comma-separated)
ALLOWED_ORIGINS="https://dashboard.example.com,https://api.example.com,http://localhost:3000"

// 4. No restriction (if not set)
// Defaults to allowing all
```

**CORS Headers Set**:
```
Access-Control-Allow-Origin: <origin or *>
Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, x-helius-secret
Access-Control-Allow-Credentials: true
```

### 1.5 Development Endpoints

When `ALLOW_DEV_ENDPOINTS=1`, additional debugging endpoints are enabled:

```typescript
// Get recent transfers
GET /dev/db/transfers?limit=50
Response: Array of TransferEvent records

// Get recent coordinated trades
GET /dev/db/coordinated?limit=50
Response: Array of CoordinatedTrade records

// Get database statistics
GET /dev/db/stats
Response: { transferCount: number, coordinatedCount: number }
```

**⚠️ Security Note**: Never enable in production!

### 1.6 Graceful Shutdown Process

```
Signal Received (SIGINT/SIGTERM)
  │
  ├─▶ 1. Log shutdown initiation
  │
  ├─▶ 2. Stop background coordinator
  │      └─▶ Clear timers
  │
  ├─▶ 3. Close HTTP server
  │      ├─▶ Stop accepting new connections
  │      ├─▶ Wait for existing requests to complete
  │      └─▶ Close all SSE streams
  │
  └─▶ 4. Exit process (code 0)
```

**Timeout**: No explicit timeout; relies on process manager (Docker, PM2) to force-kill if needed.

---

## 2. Configuration Management (config.ts)

**File**: `src/config.ts`  
**Lines of Code**: ~80  
**Purpose**: Runtime configuration with dynamic updates

### 2.1 Overview

Manages application configuration that can be:
- Initialized from environment variables
- Updated at runtime via API
- Validated with Zod schemas
- Accessed globally without imports pollution

### 2.2 Configuration Schema

```typescript
// src/config.ts
import { z } from "zod";
import { WSOL_MINT } from "./utils/parse.js";

export const ConfigSchema = z.object({
  excludeTokens: z.array(z.string()).default([WSOL_MINT]),
  minAmount: z.number().min(0).default(1),
  dedupBySignatureOnly: z.boolean().default(false),
  coordinatedWindowMinutes: z.number().int().min(1).default(5),
  coordinatedMinWallets: z.number().int().min(1).default(5),
  debugEvents: z.boolean().default(false),
  debugEventsVerbose: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  excludeTokensSet: Set<string>;  // Optimized lookup structure
};
```

### 2.3 Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `excludeTokens` | string[] | `[WSOL_MINT]` | Token mints to ignore |
| `minAmount` | number | `1` | Minimum transaction amount |
| `dedupBySignatureOnly` | boolean | `false` | Deduplication strategy |
| `coordinatedWindowMinutes` | number | `5` | Time window for coordination |
| `coordinatedMinWallets` | number | `5` | Threshold for alerts |
| `debugEvents` | boolean | `false` | Enable event logging |
| `debugEventsVerbose` | boolean | `false` | Enable verbose logging |
| `excludeTokensSet` | Set<string> | `Set([WSOL])` | Optimized token lookup |

### 2.4 Initialization from Environment

```typescript
function envBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (!v) return def;
  return v === "1" || v.toLowerCase() === "true";
}

// Parse from environment variables
const initial = ConfigSchema.parse({
  excludeTokens: (process.env.EXCLUDE_TOKENS || WSOL_MINT)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  minAmount: Number.isFinite(parseFloat(process.env.MIN_AMOUNT || ""))
    ? parseFloat(process.env.MIN_AMOUNT as string)
    : 1,
  dedupBySignatureOnly: envBool("DEDUP_BY_SIGNATURE_ONLY", false),
  coordinatedWindowMinutes: Number(process.env.COORDINATED_WINDOW_MINUTES || 5),
  coordinatedMinWallets: Number(process.env.COORDINATED_MIN_WALLETS || 5),
  debugEvents: envBool("DEBUG_EVENTS", false),
  debugEventsVerbose: envBool("DEBUG_EVENTS_VERBOSE", false),
});

// Create runtime config with Set optimization
let CONFIG: AppConfig = {
  ...initial,
  excludeTokensSet: new Set(initial.excludeTokens),
};
```

### 2.5 Runtime Access

```typescript
// Get current configuration (read-only)
export function getConfig(): AppConfig {
  return CONFIG;
}

// Usage in services
import { getConfig } from "../config.js";

const config = getConfig();
if (config.excludeTokensSet.has(tokenAddress)) {
  // Skip excluded token
}
```

### 2.6 Runtime Updates

```typescript
// Update configuration
export function setConfig(patch: Partial<z.input<typeof ConfigSchema>>): AppConfig {
  // 1. Merge with existing config
  const merged = { ...CONFIG, ...patch } as any;
  
  // 2. Validate merged config
  const parsed = ConfigSchema.parse({
    excludeTokens: merged.excludeTokens,
    minAmount: merged.minAmount,
    dedupBySignatureOnly: merged.dedupBySignatureOnly,
    coordinatedWindowMinutes: merged.coordinatedWindowMinutes,
    coordinatedMinWallets: merged.coordinatedMinWallets,
    debugEvents: merged.debugEvents,
    debugEventsVerbose: merged.debugEventsVerbose,
  });
  
  // 3. Rebuild optimized structures
  CONFIG = { 
    ...parsed, 
    excludeTokensSet: new Set(parsed.excludeTokens) 
  };
  
  return CONFIG;
}

// Usage via API
PATCH /config
Body: { "coordinatedMinWallets": 7 }
→ setConfig({ coordinatedMinWallets: 7 })
→ New config applied immediately
```

### 2.7 Serialization for API Responses

```typescript
export function configToJSON(c: AppConfig) {
  const { excludeTokensSet, ...rest } = c;
  return { ...rest };  // Exclude non-serializable Set
}

// Usage
GET /config
→ configToJSON(CONFIG)
→ { excludeTokens: [...], minAmount: 1, ... }
```

### 2.8 Configuration Update Flow

```
Client Request: PATCH /config
  │
  ├─▶ 1. Parse JSON body
  │
  ├─▶ 2. Validate partial config
  │      └─▶ Zod validation
  │
  ├─▶ 3. Call setConfig(patch)
  │      ├─▶ Merge with current
  │      ├─▶ Validate full config
  │      └─▶ Update global CONFIG
  │
  ├─▶ 4. All services see new config
  │      ├─▶ WebhookService.processWebhook()
  │      │   └─▶ getConfig() → new values
  │      └─▶ CoordinatorService.scan()
  │          └─▶ getConfig() → new values
  │
  └─▶ 5. Return updated config to client
```

### 2.9 Why This Pattern?

**Benefits**:
- ✅ **Type-safe**: Zod ensures runtime type safety
- ✅ **No restart required**: Dynamic updates
- ✅ **Global access**: Single source of truth
- ✅ **Validation**: Invalid configs rejected
- ✅ **Performance**: Set lookup O(1) vs Array O(n)

**Trade-offs**:
- ❌ Not persisted (resets on restart)
- ❌ Global mutable state (but single-threaded)
- ❌ No history tracking

---

## 3. Database Layer (db.ts)

**File**: `src/db.ts`  
**Lines of Code**: ~10  
**Purpose**: Singleton Prisma client for database access

### 3.1 Overview

Provides a single, shared Prisma client instance across the application.

### 3.2 Complete Implementation

```typescript
// src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

**That's it!** Simplicity is intentional.

### 3.3 Usage Throughout Application

```typescript
// In any service or controller
import { prisma } from "../db.js";

// Query transfers
const transfers = await prisma.transferEvent.findMany({
  where: { walletAddress: "ABC..." },
  orderBy: { timestamp: 'desc' },
  take: 100
});

// Create coordinated trade
await prisma.coordinatedTrade.create({
  data: {
    tokenAddress: "XYZ...",
    windowStart: new Date(),
    windowEnd: new Date(),
    triggeredAt: new Date(),
    uniqueWalletCount: 5,
    walletAddresses: JSON.stringify(["wallet1", "wallet2"])
  }
});
```

### 3.4 Prisma Client Features

**Automatic Features**:
- Connection pooling
- Prepared statements
- Type-safe queries
- Auto-generated TypeScript types
- Query optimization

**Configuration** (via `DATABASE_URL`):
```bash
# SQLite (current)
DATABASE_URL="file:./prisma/dev.db"

# PostgreSQL (for scaling)
DATABASE_URL="postgresql://user:pass@localhost:5432/helius_tracker"
```

### 3.5 Database Schema

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model TransferEvent {
  id            String   @id @default(cuid())
  walletAddress String
  tokenAddress  String
  amount        String   // Stored as string for precision
  signature     String
  timestamp     DateTime
  side          String   // "BUY" | "SELL"

  @@unique([walletAddress, tokenAddress, signature], name: "wallet_token_sig_unique")
  @@index([walletAddress, timestamp])
  @@index([tokenAddress, timestamp])
  @@index([signature])
}

model CoordinatedTrade {
  id                String   @id @default(cuid())
  tokenAddress      String
  windowStart       DateTime
  windowEnd         DateTime
  triggeredAt       DateTime
  uniqueWalletCount Int
  walletAddresses   String   // JSON array

  @@index([tokenAddress, windowStart])
  @@unique([tokenAddress, windowStart], name: "token_window_unique")
}
```

### 3.6 Type-Safe Queries

Prisma generates TypeScript types automatically:

```typescript
// Type is inferred automatically
const transfer: TransferEvent = await prisma.transferEvent.findUnique({
  where: { id: "clx123..." }
});

// Compile-time error if field doesn't exist
const amount = transfer.amount;  // ✅ OK
const invalid = transfer.price;  // ❌ TypeScript error

// Auto-complete in IDE
await prisma.transferEvent.findMany({
  where: {
    walletAddress: "...",  // ✅ Auto-complete available
    tokenAddress: "...",   // ✅ Auto-complete available
    invalidField: "..."    // ❌ TypeScript error
  }
});
```

### 3.7 Database Migrations

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate

# Deploy migrations (production)
npm run db:migrate:prod

# Open Prisma Studio (GUI)
npm run db:studio
```

### 3.8 Connection Management

**No manual connection handling needed!**

Prisma automatically:
- Opens connection on first query
- Maintains connection pool
- Reuses connections
- Handles disconnection gracefully

**Explicit disconnect** (optional, for clean shutdown):
```typescript
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

---

## 4. Real-time Streaming (realtime.ts)

**File**: `src/realtime.ts`  
**Lines of Code**: ~120  
**Purpose**: Server-Sent Events (SSE) implementation for real-time data

### 4.1 Overview

Manages persistent HTTP connections for streaming events to clients:
- Transfer events
- Coordinated trade alerts
- Combined streams

### 4.2 SSE Stream Types

```typescript
// Type definitions for broadcasts
export type TransferBroadcast = {
  walletAddress: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  timestamp: string;  // ISO 8601
  side: "BUY" | "SELL";
};

export type CoordinatedBroadcast = {
  tokenAddress: string;
  windowStart: string;
  windowEnd: string;
  triggeredAt: string;
  uniqueWalletCount: number;
  walletAddresses: string[];
};
```

### 4.3 Client Management

```typescript
// In-memory client lists
const transfersClients = new Set<Response>();
const coordinatedClients = new Set<Response>();
const allClients = new Set<Response>();

// Keep-alive heartbeat timers
const heartbeats = new WeakMap<Response, NodeJS.Timeout>();
```

### 4.4 SSE Setup Function

```typescript
function setupSse(res: Response, origin?: string) {
  // Set SSE headers
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");  // Disable nginx buffering
  res.setHeader("Vary", "Origin");
  
  // Apply CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins === '*' || !allowedOrigins) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (allowedOrigins && origin) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    if (origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cache-Control");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  // Flush headers immediately
  (res as any).flushHeaders?.();
  
  // Send initial connection message
  res.write(": connected\n\n");
  
  // Start keep-alive heartbeat (every 15 seconds)
  const timer = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      // Client disconnected, ignore
    }
  }, 15000);
  
  heartbeats.set(res, timer);
}
```

### 4.5 Stream Endpoints

```typescript
export function initRealtime(app: Express, _server?: HttpServer) {
  // Stream 1: Transfers only
  app.get("/stream/transfers", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    transfersClients.add(res);
    
    req.on("close", () => {
      transfersClients.delete(res);
      teardownSse(res);
    });
  });

  // Stream 2: Coordinated trades only
  app.get("/stream/coordinated", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    coordinatedClients.add(res);
    
    req.on("close", () => {
      coordinatedClients.delete(res);
      teardownSse(res);
    });
  });

  // Stream 3: Combined (with named events)
  app.get("/stream/all", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    allClients.add(res);
    
    req.on("close", () => {
      allClients.delete(res);
      teardownSse(res);
    });
  });
}
```

### 4.6 Publishing Events

```typescript
export function publishTransfers(rows: TransferBroadcast[]) {
  if (rows.length === 0) return;
  
  // De-duplicate by signature
  const unique: TransferBroadcast[] = [];
  const seen = new Set<string>();
  
  for (const row of rows) {
    if (!seen.has(row.signature)) {
      seen.add(row.signature);
      unique.push(row);
    }
  }
  
  if (unique.length === 0) return;

  const data = JSON.stringify(unique);
  
  // Dedicated transfers stream
  for (const res of Array.from(transfersClients)) {
    const ok = safeWrite(res, `data: ${data}\n\n`);
    if (!ok) transfersClients.delete(res);
  }
  
  // Combined stream with named event
  for (const res of Array.from(allClients)) {
    const ok = safeWrite(res, `event: transfers\ndata: ${data}\n\n`);
    if (!ok) allClients.delete(res);
  }
}

export function publishCoordinated(row: CoordinatedBroadcast) {
  const data = JSON.stringify(row);
  
  // Dedicated coordinated stream
  for (const res of Array.from(coordinatedClients)) {
    const ok = safeWrite(res, `data: ${data}\n\n`);
    if (!ok) coordinatedClients.delete(res);
  }
  
  // Combined stream with named event
  for (const res of Array.from(allClients)) {
    const ok = safeWrite(res, `event: coordinated\ndata: ${data}\n\n`);
    if (!ok) allClients.delete(res);
  }
}
```

### 4.7 SSE Message Format

**Transfer Event**:
```
data: [{"walletAddress":"ABC...","tokenAddress":"XYZ...","amount":"100.5","signature":"sig123","timestamp":"2025-11-08T10:00:00.000Z","side":"BUY"}]

```

**Coordinated Event**:
```
data: {"tokenAddress":"XYZ...","windowStart":"2025-11-08T10:00:00.000Z","windowEnd":"2025-11-08T10:05:00.000Z","triggeredAt":"2025-11-08T10:03:47.123Z","uniqueWalletCount":5,"walletAddresses":["wallet1","wallet2",...]}

```

**Combined Stream** (with event names):
```
event: transfers
data: [...]

event: coordinated
data: {...}

```

### 4.8 Client Connection Example

```javascript
// Browser/Node.js client
const eventSource = new EventSource('http://localhost:8080/stream/coordinated');

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Coordinated trade:', data);
});

eventSource.addEventListener('error', (error) => {
  console.error('Connection error:', error);
});

// Combined stream with event types
const allStream = new EventSource('http://localhost:8080/stream/all');

allStream.addEventListener('transfers', (event) => {
  const transfers = JSON.parse(event.data);
  console.log('Transfers:', transfers);
});

allStream.addEventListener('coordinated', (event) => {
  const coordination = JSON.parse(event.data);
  console.log('Coordination:', coordination);
});
```

### 4.9 Connection Management

**Automatic Cleanup**:
```typescript
req.on("close", () => {
  // Client disconnected
  clients.delete(res);
  teardownSse(res);
});

function teardownSse(res: Response) {
  // Stop heartbeat
  const timer = heartbeats.get(res);
  if (timer) clearInterval(timer);
  heartbeats.delete(res);
  
  // Close connection
  try { res.end(); } catch {}
}
```

**Keep-Alive Heartbeat**:
```
: keepalive

: keepalive

: keepalive
```

Sent every 15 seconds to prevent proxy/firewall timeouts.

### 4.10 Error Handling

```typescript
function safeWrite(res: Response, chunk: string): boolean {
  try {
    res.write(chunk);
    return true;  // Success
  } catch {
    return false;  // Failed, client should be removed
  }
}
```

**Automatic client removal** on write failure.

---

## 5. Webhook Verification (verify.ts)

**File**: `src/verify.ts`  
**Lines of Code**: ~30  
**Purpose**: Verify Helius webhook signatures

### 5.1 Overview

Ensures webhook requests are authentic and from Helius.

### 5.2 Implementation

```typescript
// src/verify.ts
import { createHmac } from "node:crypto";

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Calculate expected signature
    const expectedSignature = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    
    // Constant-time comparison
    return signature === expectedSignature;
  } catch (error) {
    return false;
  }
}
```

### 5.3 Usage in Middleware

```typescript
// src/middleware/auth.ts
import { verifyWebhookSignature } from "../verify.js";
import { getEnv } from "../lib/env.js";

export function authenticateWebhook(req, res, next) {
  const signature = req.headers["x-helius-secret"];
  const body = JSON.stringify(req.body);
  const secret = getEnv().WEBHOOK_SECRET;
  
  if (!signature || !verifyWebhookSignature(body, signature, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  next();
}
```

### 5.4 Signature Verification Process

```
Helius Server                           Your Server
     │                                       │
     ├─▶ 1. Prepare webhook payload          │
     │      body = JSON.stringify(events)    │
     │                                       │
     ├─▶ 2. Calculate signature              │
     │      signature = HMAC-SHA256(         │
     │        key=WEBHOOK_SECRET,            │
     │        data=body                      │
     │      )                                │
     │                                       │
     ├─▶ 3. Send POST request                │
     │      Headers:                         │
     │        x-helius-secret: <signature>   │
     │      Body: <payload>                  │
     │                                       │
     │                                       ├─▶ 4. Receive request
     │                                       │
     │                                       ├─▶ 5. Extract signature from header
     │                                       │
     │                                       ├─▶ 6. Calculate expected signature
     │                                       │      using same algorithm
     │                                       │
     │                                       ├─▶ 7. Compare signatures
     │                                       │      if match → Accept
     │                                       │      if not   → Reject (401)
     │                                       │
     ├─▶ Success response                    │
     │   200 OK                              │
```

### 5.5 Security Properties

- **HMAC-SHA256**: Cryptographically secure
- **Secret key**: Shared between Helius and your server
- **Tamper-proof**: Any modification invalidates signature
- **Replay-safe**: Signatures are deterministic but request-specific

---

## 6. Type Definitions (types.ts)

**File**: `src/types.ts`  
**Lines of Code**: ~15  
**Purpose**: Shared TypeScript type definitions

### 6.1 Complete Definitions

```typescript
// src/types.ts
export type Side = "BUY" | "SELL";

export interface ParsedTransfer {
  walletAddress: string;  // The tracked wallet address
  tokenAddress: string;   // SPL token mint or WSOL for native SOL
  amount: string;         // Decimal string (e.g., "100.5")
  signature: string;      // Transaction signature
  timestamp: string;      // ISO 8601 timestamp
  side: Side;             // BUY if wallet receives, SELL if sends
}
```

### 6.2 Usage Examples

```typescript
// In parser
import type { ParsedTransfer, Side } from "../types.js";

function parseEvent(...): ParsedTransfer[] {
  const transfers: ParsedTransfer[] = [];
  
  transfers.push({
    walletAddress: "ABC...",
    tokenAddress: "XYZ...",
    amount: "100.5",
    signature: "sig123",
    timestamp: new Date().toISOString(),
    side: "BUY"
  });
  
  return transfers;
}
```

### 6.3 Type Safety Benefits

```typescript
// TypeScript enforces correct types
const transfer: ParsedTransfer = {
  walletAddress: "ABC...",
  tokenAddress: "XYZ...",
  amount: "100",
  signature: "sig",
  timestamp: new Date().toISOString(),
  side: "BUY"  // ✅ OK: valid Side value
};

const invalid: ParsedTransfer = {
  // ...
  side: "HOLD"  // ❌ Error: "HOLD" not assignable to Side
};
```

---

## 7. Component Interaction Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPONENT INTERACTION                        │
└─────────────────────────────────────────────────────────────────┘

app.ts
  │
  ├─▶ lib/env.ts → validateEnv()
  │     └─▶ Returns validated environment
  │
  ├─▶ middleware/auth.ts → authenticateWebhook()
  │     └─▶ verify.ts → verifyWebhookSignature()
  │
  ├─▶ routes/webhook.ts → POST /helius
  │     └─▶ controllers/webhook.ts → handleWebhook()
  │           └─▶ services/webhook.ts → processWebhook()
  │                 ├─▶ utils/parse.ts → parseHeliusEvent()
  │                 │     └─▶ types.ts → ParsedTransfer
  │                 │
  │                 ├─▶ config.ts → getConfig()
  │                 │
  │                 ├─▶ db.ts → prisma.transferEvent.create()
  │                 │
  │                 └─▶ realtime.ts → publishTransfers()
  │
  ├─▶ services/coordinator.ts → Background scanner
  │     ├─▶ config.ts → getConfig()
  │     ├─▶ db.ts → prisma queries
  │     └─▶ realtime.ts → publishCoordinated()
  │
  └─▶ realtime.ts → SSE streams
        ├─▶ /stream/transfers
        ├─▶ /stream/coordinated
        └─▶ /stream/all
```

---

## Next Steps

- **[SERVICES.md](./SERVICES.md)** - Detailed service layer documentation
- **[DATA_PROCESSING.md](./DATA_PROCESSING.md)** - Data transformation pipeline
- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** - Complete API reference

---

**Document Version**: 1.0  
**Last Updated**: November 8, 2025  
**Author**: System Documentation  
**Status**: Production Ready
