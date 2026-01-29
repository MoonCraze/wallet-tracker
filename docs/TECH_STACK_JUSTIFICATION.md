# Technology Stack Justification

**Project:** Helius Wallet Tracker  
**Component:** Wallet Tracking Module  
**Date:** January 10, 2026  
**Version:** v9-production

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Technology Choices](#2-core-technology-choices)
3. [Database Selection](#3-database-selection)
4. [Backend Framework](#4-backend-framework)
5. [Real-Time Communication](#5-real-time-communication)
6. [Development & Build Tools](#6-development--build-tools)
7. [Containerization & Deployment](#7-containerization--deployment)
8. [Blockchain Integration](#8-blockchain-integration)
9. [Security & Authentication](#9-security--authentication)
10. [Summary Comparison Tables](#10-summary-comparison-tables)

---

## 1. Executive Summary

The Helius Wallet Tracker is a real-time blockchain monitoring system designed to track whale wallet activities on the Solana blockchain. The technology stack was carefully selected to meet the following critical requirements:

- **High-throughput data ingestion** from blockchain webhooks
- **Sub-second latency** for real-time event broadcasting
- **Time-series optimized storage** for historical analysis
- **Horizontal scalability** for production workloads
- **Type safety** for maintainable codebase
- **Containerized deployment** for consistent environments

---

## 2. Core Technology Choices

### 2.1 TypeScript over JavaScript

**Choice:** TypeScript 5.5+

**Why TypeScript?**

| Aspect | TypeScript | JavaScript |
|--------|------------|------------|
| Type Safety | ✅ Compile-time type checking | ❌ Runtime errors only |
| IDE Support | ✅ Superior autocomplete, refactoring | ⚠️ Limited IntelliSense |
| Code Quality | ✅ Catches bugs before runtime | ❌ Errors in production |
| Documentation | ✅ Types serve as documentation | ❌ Requires separate docs |
| Team Scalability | ✅ Easier onboarding | ⚠️ Harder to understand intent |

**Why Not Other Languages?**

| Alternative | Reason for Not Choosing |
|-------------|------------------------|
| **Python** | Slower execution speed, GIL limitations for concurrent I/O, weaker type system (even with type hints) |
| **Go** | Steeper learning curve, less mature ecosystem for web APIs, verbose error handling |
| **Rust** | Overkill for I/O-bound application, slower development velocity, complex memory management |
| **Java** | Heavy runtime overhead, verbose syntax, slower startup times for containerized deployments |

**Key Benefits for This Project:**
- Zod schema validation integrates seamlessly with TypeScript types
- Prisma generates fully-typed database clients
- Express middleware benefits from typed request/response objects
- Better maintainability for a complex trading system

---

## 3. Database Selection

### 3.1 PostgreSQL with TimescaleDB

**Choice:** PostgreSQL (Neon.tech) + TimescaleDB Extension

**Why PostgreSQL over Other Databases?**

| Database | Pros | Cons | Verdict |
|----------|------|------|---------|
| **PostgreSQL** | ACID compliance, mature ecosystem, extensible, excellent JSON support | Requires more setup than SQLite | ✅ **Selected** |
| **SQLite** | Zero-config, file-based, great for dev | No concurrent writes, limited scalability, no time-series optimization | ❌ Dev only |
| **MongoDB** | Flexible schema, horizontal scaling | Eventually consistent, no native time-series, complex aggregations | ❌ Not suitable |
| **MySQL** | Popular, well-documented | Weaker JSON support, less extensible | ❌ Less flexible |
| **InfluxDB** | Purpose-built for time-series | Separate query language, limited relational capabilities | ❌ Single-purpose |

### 3.2 Why TimescaleDB Extension?

Our application ingests **high-frequency transfer events** and performs **time-based pattern detection**. TimescaleDB provides:

| Feature | Benefit for Wallet Tracker |
|---------|---------------------------|
| **Hypertables** | Automatic time-based partitioning for TransferEvent table |
| **Chunk Compression** | 90%+ storage reduction for historical data |
| **Time-bucket queries** | 10-100x faster time-range queries for coordinated trade detection |
| **Continuous Aggregates** | Pre-computed hourly/daily statistics |
| **Retention Policies** | Automatic cleanup of old data |

**Query Performance Comparison:**

```sql
-- Regular PostgreSQL: Full table scan
SELECT * FROM "TransferEvent" 
WHERE timestamp > NOW() - INTERVAL '1 hour'
-- Execution time: ~500ms on 1M rows

-- TimescaleDB: Only scans relevant chunks
SELECT * FROM "TransferEvent" 
WHERE timestamp > NOW() - INTERVAL '1 hour'
-- Execution time: ~5ms on 1M rows (100x improvement)
```

### 3.3 Why Neon.tech for Hosting?

| Provider | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Neon.tech** | Serverless, auto-scaling, branching, generous free tier | Newer platform | ✅ **Selected** |
| **Supabase** | Full backend features | Overkill, higher cost | ❌ Too much |
| **AWS RDS** | Enterprise-grade | Complex setup, higher cost | ❌ Overhead |
| **PlanetScale** | Great for MySQL | MySQL only, no TimescaleDB | ❌ Wrong DB |
| **Self-hosted** | Full control | Operational burden | ❌ Maintenance |

---

## 4. Backend Framework

### 4.1 Express.js

**Choice:** Express 4.x

**Why Express over Other Frameworks?**

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Express** | Mature, minimal, flexible, huge ecosystem | Manual structure needed | ✅ **Selected** |
| **Fastify** | Faster benchmarks, built-in validation | Less middleware ecosystem | ⚠️ Close second |
| **NestJS** | Structured, enterprise patterns | Heavy, opinionated, Angular-style | ❌ Too heavy |
| **Koa** | Modern async/await | Smaller ecosystem | ❌ Less mature |
| **Hapi** | Configuration-driven | Verbose, declining popularity | ❌ Declining |
| **Next.js API Routes** | Full-stack | SSR overhead, not needed here | ❌ Wrong fit |

**Why Express Wins for This Project:**

1. **Minimal Overhead** - Wallet tracker is a focused microservice, not a full web application
2. **SSE Support** - Native support for Server-Sent Events streaming
3. **Middleware Ecosystem** - CORS, authentication, error handling readily available
4. **Production Proven** - Battle-tested in high-traffic environments
5. **Team Familiarity** - Most Node.js developers know Express

### 4.2 Prisma ORM

**Choice:** Prisma 5.x

**Why Prisma over Other ORMs?**

| ORM | Pros | Cons | Verdict |
|-----|------|------|---------|
| **Prisma** | Type-safe, auto-generated client, migrations, Studio GUI | Larger bundle size | ✅ **Selected** |
| **TypeORM** | Decorators, Active Record pattern | Less type-safe, complex setup | ❌ Weaker types |
| **Sequelize** | Mature, widely used | JavaScript-first, verbose | ❌ Outdated |
| **Knex.js** | Lightweight query builder | No type generation, manual types | ❌ More work |
| **Drizzle** | Lightweight, TypeScript-first | Newer, less documented | ⚠️ Emerging |
| **Raw SQL** | Full control | No type safety, error-prone | ❌ Risky |

**Prisma Benefits for Wallet Tracker:**

```typescript
// Auto-generated types from schema
const event = await prisma.transferEvent.create({
  data: {
    walletAddress: "...",  // TypeScript knows this is required string
    tokenAddress: "...",
    amount: "1000",        // String to avoid floating-point precision issues
    signature: "...",
    timestamp: new Date(),
    side: "BUY"            // Type-checked enum
  }
});
// event is fully typed: TransferEvent
```

---

## 5. Real-Time Communication

### 5.1 Server-Sent Events (SSE)

**Choice:** SSE over WebSockets

**Why SSE for Real-Time Streaming?**

| Protocol | Pros | Cons | Verdict |
|----------|------|------|---------|
| **SSE** | Simpler, HTTP-based, auto-reconnect, unidirectional | One-way only | ✅ **Selected** |
| **WebSockets** | Bidirectional, binary support | Complex, manual reconnection | ❌ Overkill |
| **Polling** | Simple implementation | High latency, wasteful | ❌ Inefficient |
| **Long Polling** | Works everywhere | Resource-intensive | ❌ Outdated |
| **GraphQL Subscriptions** | Typed, filtered | Heavy infrastructure | ❌ Complex |

**SSE is Perfect for Wallet Tracker Because:**

1. **Unidirectional Data Flow** - Server pushes events to clients; clients don't send data back
2. **Automatic Reconnection** - Browser handles reconnection with `EventSource`
3. **HTTP Infrastructure** - Works with existing proxies, load balancers, CDNs
4. **Simpler Implementation** - No WebSocket server library needed
5. **Named Events** - Can separate `transfer` and `coordinated` event streams

**Implementation Pattern:**

```typescript
// Server sends named events
res.write(`event: transfer\n`);
res.write(`data: ${JSON.stringify(transferData)}\n\n`);

res.write(`event: coordinated\n`);
res.write(`data: ${JSON.stringify(coordinatedData)}\n\n`);

// Client receives typed events
const source = new EventSource('/stream/all');
source.addEventListener('transfer', (e) => handleTransfer(e));
source.addEventListener('coordinated', (e) => handleCoordinated(e));
```

### 5.2 WebSocket Support (ws Library)

We also include the `ws` library for:
- Future bidirectional communication needs
- Health monitoring connections
- Internal service communication

---

## 6. Development & Build Tools

### 6.1 tsx for Development

**Choice:** tsx (TypeScript Execute)

**Why tsx over Other Runners?**

| Runner | Pros | Cons | Verdict |
|--------|------|------|---------|
| **tsx** | Fast, ESM support, watch mode | Newer | ✅ **Selected** |
| **ts-node** | Mature, widely used | Slower, ESM issues | ❌ Legacy |
| **nodemon + tsc** | Reliable | Slow, two-step process | ❌ Clunky |
| **Bun** | Fastest | Less compatible, newer | ⚠️ Future option |
| **Deno** | Secure by default | Different ecosystem | ❌ Different runtime |

**tsx Advantages:**
- Zero configuration ESM support
- Built-in watch mode (`tsx watch`)
- Compatible with Node.js ecosystem
- Significantly faster than ts-node

### 6.2 Zod for Validation

**Choice:** Zod 3.x

**Why Zod over Other Validators?**

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **Zod** | TypeScript-first, inference, composable | Slightly larger bundle | ✅ **Selected** |
| **Joi** | Mature, expressive | No type inference | ❌ No types |
| **Yup** | React ecosystem | Weaker TypeScript support | ❌ Frontend-focused |
| **class-validator** | Decorators | Requires classes | ❌ OOP-style |
| **io-ts** | Functional, type-safe | Steeper learning curve | ⚠️ Complex |

**Zod Integration Example:**

```typescript
import { z } from 'zod';

const TransferSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  tokenAddress: z.string().min(32).max(44),
  amount: z.string(), // String for precision
  side: z.enum(['BUY', 'SELL'])
});

// TypeScript type automatically inferred
type Transfer = z.infer<typeof TransferSchema>;
```

---

## 7. Containerization & Deployment

### 7.1 Docker with Multi-Stage Builds

**Choice:** Docker with Node.js 18 Alpine

**Why Docker?**

| Deployment | Pros | Cons | Verdict |
|------------|------|------|---------|
| **Docker** | Consistent environments, easy scaling, isolation | Container overhead | ✅ **Selected** |
| **Bare Metal** | No overhead | Environment inconsistency | ❌ Hard to reproduce |
| **PM2 Only** | Simple Node.js process management | No isolation | ❌ Limited |
| **Serverless** | Auto-scaling, pay-per-use | Cold starts, WebSocket limitations | ❌ SSE issues |

**Multi-Stage Build Benefits:**

```dockerfile
# Build stage - includes devDependencies
FROM node:18 AS builder
RUN npm ci && npm run build

# Production stage - minimal image
FROM node:18 AS production
COPY --from=builder /app/dist ./dist/
# Only production dependencies, ~70% smaller image
```

| Stage | Image Size | Contents |
|-------|------------|----------|
| Builder | ~1.2GB | Full dev environment |
| Production | ~350MB | Only runtime essentials |

### 7.2 Docker Compose for Orchestration

Simplified deployment with:
- Environment variable management
- Volume mounting for logs
- Health checks
- Restart policies

---

## 8. Blockchain Integration

### 8.1 Helius API

**Choice:** Helius Enhanced Webhooks

**Why Helius over Other Providers?**

| Provider | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Helius** | Enhanced webhooks, Solana-focused, parsed transactions | Paid for high volume | ✅ **Selected** |
| **QuickNode** | Multi-chain, reliable | Generic webhooks, less parsing | ❌ Less specialized |
| **Alchemy** | Enterprise-grade | Ethereum-focused, Solana limited | ❌ Wrong chain focus |
| **Self-hosted RPC** | Full control, free | Infrastructure burden, maintenance | ❌ Complex |
| **Public RPC** | Free | Rate limits, unreliable | ❌ Not production-ready |

**Helius Advantages for Wallet Tracking:**

1. **Enhanced Transaction Parsing** - Pre-parsed token transfers, no manual decoding
2. **Account Webhooks** - Monitor specific wallet addresses
3. **Reliable Delivery** - Retry mechanisms, guaranteed delivery
4. **Low Latency** - Events delivered within seconds of confirmation

**Webhook Payload Structure:**

```json
{
  "type": "TRANSFER",
  "source": "SYSTEM_PROGRAM",
  "tokenTransfers": [
    {
      "fromUserAccount": "...",
      "toUserAccount": "...",
      "tokenAmount": 1000,
      "mint": "TokenAddress..."
    }
  ]
}
```

---

## 9. Security & Authentication

### 9.1 JWT Authentication

**Choice:** JSON Web Tokens (jsonwebtoken library)

**Why JWT?**

| Method | Pros | Cons | Verdict |
|--------|------|------|---------|
| **JWT** | Stateless, scalable, standardized | Token size, can't revoke easily | ✅ **Selected** |
| **Session Cookies** | Server-controlled, revocable | Stateful, requires session store | ❌ Doesn't scale |
| **API Keys** | Simple | No expiration logic, basic | ⚠️ Used for webhooks |
| **OAuth 2.0** | Industry standard | Complex for internal API | ❌ Overkill |

**JWT for Microservice Communication:**
- Stateless authentication between services
- Configurable expiration
- Payload can include user roles and permissions

### 9.2 Webhook Secret Validation

For Helius webhook authentication:
- HMAC-based secret verification
- Prevents unauthorized webhook submissions
- Simple header-based validation

---

## 10. Summary Comparison Tables

### 10.1 Complete Tech Stack at a Glance

| Category | Choice | Primary Alternative | Why Not Alternative |
|----------|--------|--------------------|--------------------|
| **Language** | TypeScript | Python | Performance, type safety |
| **Runtime** | Node.js 18 | Deno/Bun | Ecosystem maturity |
| **Framework** | Express | Fastify | Ecosystem, familiarity |
| **Database** | PostgreSQL + TimescaleDB | MongoDB | Time-series optimization, ACID |
| **ORM** | Prisma | TypeORM | Type generation, DX |
| **Real-time** | SSE | WebSockets | Simplicity, HTTP compatibility |
| **Validation** | Zod | Joi | TypeScript inference |
| **Dev Runner** | tsx | ts-node | Speed, ESM support |
| **Containerization** | Docker | Serverless | SSE support, control |
| **Blockchain API** | Helius | QuickNode | Solana specialization |
| **Auth** | JWT | Sessions | Stateless, scalable |

### 10.2 Non-Functional Requirements Mapping

| Requirement | How Tech Stack Addresses It |
|-------------|----------------------------|
| **High Throughput** | Express async handlers, PostgreSQL connection pooling |
| **Low Latency** | SSE streaming, TimescaleDB chunk queries |
| **Scalability** | Stateless design, Docker horizontal scaling |
| **Type Safety** | TypeScript, Prisma, Zod throughout |
| **Maintainability** | Clear layered architecture, typed interfaces |
| **Reliability** | Health checks, error handling, graceful shutdown |
| **Security** | JWT auth, webhook secrets, CORS configuration |
| **Observability** | Structured JSON logging, health endpoints |

### 10.3 Cost-Benefit Analysis

| Technology | Cost | Benefit |
|------------|------|---------|
| **TypeScript** | Learning curve for JS developers | Long-term maintainability |
| **PostgreSQL/TimescaleDB** | Neon.tech free tier, then $19/mo | 100x faster time queries |
| **Helius API** | Free tier: 30 RPS, then paid | Reliable webhook delivery |
| **Docker** | Container orchestration learning | Consistent deployments |

---

## Conclusion

The technology stack for the Helius Wallet Tracker was selected based on:

1. **Performance Requirements** - High-throughput, low-latency event processing
2. **Data Characteristics** - Time-series nature of blockchain events
3. **Scalability Needs** - Horizontal scaling for production workloads
4. **Developer Experience** - Type safety, modern tooling, fast iteration
5. **Operational Simplicity** - Containerized deployment, managed database
6. **Domain Expertise** - Helius's Solana specialization

Each technology choice represents a deliberate trade-off analysis, optimizing for the specific requirements of a real-time blockchain monitoring system while maintaining a maintainable and scalable codebase.

---

*Document prepared as part of the Final Year Project documentation.*
