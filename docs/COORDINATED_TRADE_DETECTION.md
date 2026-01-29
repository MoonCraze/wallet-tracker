# Coordinated Trade Detection

**Project:** Helius Wallet Tracker  
**Component:** Coordinated Trade Detection Engine  
**Date:** November 8, 2025  
**Version:** v9-production

---

## Table of Contents

1. [Detection Algorithm Overview](#1-detection-algorithm-overview)
2. [Time Window Bucketing](#2-time-window-bucketing)
3. [Wallet Counting Logic](#3-wallet-counting-logic)
4. [Threshold Configuration](#4-threshold-configuration)
5. [Deduplication Strategy](#5-deduplication-strategy)
6. [Output Format for Trading Module](#6-output-format-for-trading-module)

---

## 1. Detection Algorithm Overview

### 1.1 Purpose

The coordinated trade detection algorithm identifies situations where **multiple tracked wallets purchase the same token within a defined time window**, suggesting coordinated buying activity that may indicate:

- Insider trading patterns
- Whale accumulation
- Coordinated pump schemes
- Early-stage token discovery by influential wallets

### 1.2 Core Concept

```
If N or more tracked wallets BUY the same token within T minutes
→ Trigger coordinated trade alert
→ Broadcast token address to trading module
→ Trading module can execute copy-trading or analysis
```

### 1.3 Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│           COORDINATED TRADE DETECTION ALGORITHM                  │
└─────────────────────────────────────────────────────────────────┘

                         START
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  Trigger Event:                      │
        │  • New BUY transfer saved            │
        │  • Background scan timer fired       │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  1. Calculate Time Window            │
        │     windowStart = floor(now, 5min)   │
        │     windowEnd = windowStart + 5min   │
        │     Example:                         │
        │       now = 10:03:47                 │
        │       window = 10:00:00 - 10:05:00   │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  2. Identify Candidate Tokens        │
        │     SELECT DISTINCT tokenAddress     │
        │     FROM TransferEvent               │
        │     WHERE side = 'BUY'               │
        │       AND timestamp >= windowStart   │
        │       AND timestamp < now            │
        │       AND NOT in excludedTokens      │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  3. For Each Candidate Token:        │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  4. Check Deduplication              │
        │     Already processed this window?   │
        │     SELECT FROM CoordinatedTrade     │
        │     WHERE token = T AND window = W   │
        │     IF found → SKIP                  │
        └──────────────┬───────────────────────┘
                       │ Not processed yet
                       ▼
        ┌──────────────────────────────────────┐
        │  5. Count Unique Wallets             │
        │     SELECT DISTINCT walletAddress    │
        │     FROM TransferEvent               │
        │     WHERE tokenAddress = T           │
        │       AND side = 'BUY'               │
        │       AND timestamp >= windowStart   │
        │       AND timestamp < now            │
        │                                      │
        │     uniqueWallets = COUNT(results)   │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  6. Threshold Check                  │
        │     IF uniqueWallets >= threshold    │
        │     THEN → ALERT                     │
        │     ELSE → SKIP                      │
        └──────────────┬───────────────────────┘
                       │ Threshold met
                       ▼
        ┌──────────────────────────────────────┐
        │  7. Create Alert Record              │
        │     INSERT INTO CoordinatedTrade     │
        │     • tokenAddress                   │
        │     • windowStart, windowEnd         │
        │     • triggeredAt = now              │
        │     • uniqueWalletCount              │
        │     • walletAddresses (JSON array)   │
        └──────────────┬───────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │  8. Broadcast Alert                  │
        │     publishCoordinated(event)        │
        │     → SSE streams                    │
        │     → Trading module receives alert  │
        └──────────────┬───────────────────────┘
                       │
                       ▼
                      END
```

### 1.4 Dual Detection Paths

The system uses **two parallel detection mechanisms** for reliability:

#### Path 1: Real-time Detection (Webhook Service)
```typescript
// services/webhook.ts
async processWebhook(body, headers) {
  // 1. Process transfers
  const newTransfers = await this.saveTransfers(...);
  
  // 2. Collect tokens with BUY activity
  const touchedTokens = new Set<string>();
  for (const transfer of newTransfers) {
    if (transfer.side === "BUY") {
      touchedTokens.add(transfer.tokenAddress);
    }
  }
  
  // 3. Check for coordination immediately
  if (touchedTokens.size > 0) {
    await this.checkCoordinatedTrades(touchedTokens);
  }
}
```

**Trigger**: Immediately after saving BUY transfers  
**Latency**: Sub-second detection  
**Scope**: Only checks tokens in current webhook payload  

#### Path 2: Background Scanning (Coordinator Service)
```typescript
// services/coordinator.ts
class CoordinatedTradeScanner {
  async scanForCoordinatedTrades() {
    // 1. Find ALL tokens with BUY activity in window
    const tokensWithBuys = await prisma.transferEvent.findMany({
      where: { side: "BUY", timestamp: { gte: windowStart, lt: now } },
      select: { tokenAddress: true },
      distinct: ["tokenAddress"]
    });
    
    // 2. Check each token for coordination
    for (const { tokenAddress } of tokensWithBuys) {
      await this.checkTokenForCoordination(tokenAddress, ...);
    }
  }
  
  start() {
    // Runs every 30-60 seconds
    const intervalMs = Math.min(60_000, Math.floor(windowMs / 2));
    setTimeout(scan, intervalMs);
  }
}
```

**Trigger**: Timer-based (every 30-60 seconds)  
**Latency**: Up to 60 seconds  
**Scope**: Scans ALL active tokens  
**Purpose**: Backup mechanism to catch missed patterns  

---

## 2. Time Window Bucketing

### 2.1 Window Calculation

Time windows are **discrete buckets** aligned to clock boundaries:

```typescript
function floorToWindowStart(date: Date): Date {
  const config = getConfig();
  const windowMs = config.coordinatedWindowMinutes * 60_000;
  const timestamp = date.getTime();
  return new Date(Math.floor(timestamp / windowMs) * windowMs);
}
```

### 2.2 Window Examples

**Configuration**: `COORDINATED_WINDOW_MINUTES=5`

| Current Time | Window Start | Window End | Window Duration |
|--------------|--------------|------------|-----------------|
| 10:00:00 | 10:00:00 | 10:05:00 | 5 minutes |
| 10:01:30 | 10:00:00 | 10:05:00 | 5 minutes |
| 10:03:47 | 10:00:00 | 10:05:00 | 5 minutes |
| 10:04:59 | 10:00:00 | 10:05:00 | 5 minutes |
| 10:05:00 | 10:05:00 | 10:10:00 | 5 minutes |
| 10:05:01 | 10:05:00 | 10:10:00 | 5 minutes |

**Key Properties**:
- Windows never overlap
- Windows are aligned to clock boundaries
- Multiple events in same window are grouped together
- Window boundaries are **inclusive start, exclusive end**: `[start, end)`

### 2.3 Window Alignment Visualization

```
Timeline (5-minute windows):
────────────────────────────────────────────────────────────────
        10:00:00                 10:05:00                 10:10:00
           │                        │                        │
           ├────── Window 1 ────────┤                       │
           │      [10:00, 10:05)    │                       │
           │                        │                       │
           │                        ├────── Window 2 ───────┤
           │                        │    [10:05, 10:10)     │
           │                        │                       │

Events:
  │         ▼ BUY (10:01)
  │                ▼ BUY (10:02)
  │                     ▼ BUY (10:03:47) ← Detection triggered here
  │                                 ▼ BUY (10:04:50)
  │                                        ▼ BUY (10:05:10) ← New window
  
Detection at 10:03:47:
  • Window: [10:00:00, 10:05:00)
  • Counts events at: 10:01, 10:02, 10:03:47
  • Does NOT count event at 10:04:50 (future)
  • Does NOT count event at 10:05:10 (next window)
```

### 2.4 No Look-Ahead Bias

**Critical**: The algorithm only counts events that have **already occurred**:

```typescript
// CORRECT: Only count up to trigger time
const buyers = await prisma.transferEvent.findMany({
  where: {
    tokenAddress,
    side: "BUY",
    timestamp: { 
      gte: windowStart,  // Window start (inclusive)
      lt: triggeredAt    // Current time (exclusive) - NO FUTURE EVENTS
    }
  }
});
```

**Why this matters**:
- Prevents false positives from future events
- Ensures alerts are actionable in real-time
- Trading module receives alerts based on past data only

### 2.5 Window Configuration Trade-offs

| Window Size | Pros | Cons | Use Case |
|-------------|------|------|----------|
| **1 minute** | Fastest detection, tight synchronization | Many false negatives, wallets may not coordinate that tightly | High-frequency trading |
| **5 minutes** (default) | Good balance, catches most patterns | Some lag, may miss very quick coordination | General whale tracking |
| **10 minutes** | Catches slower coordination, fewer false positives | Slower alerts, trades may execute before alert | Conservative tracking |
| **30 minutes** | Very high confidence patterns | Very slow, market may move before alert | Long-term pattern analysis |

**Recommendation**: Start with 5 minutes, adjust based on observed patterns.

---

## 3. Wallet Counting Logic

### 3.1 Unique Wallet Identification

The algorithm counts **distinct wallet addresses** that executed BUY transactions:

```typescript
// Count unique buying wallets
const buyers = await prisma.transferEvent.findMany({
  where: {
    tokenAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    side: "BUY",
    timestamp: { gte: windowStart, lt: triggeredAt }
  },
  select: { walletAddress: true },
  distinct: ["walletAddress"]  // ← Key: Only unique wallets
});

const uniqueWallets = buyers.map(b => b.walletAddress);
const count = uniqueWallets.length;
```

### 3.2 Why Only BUY Side?

The algorithm **only considers BUY transactions** for coordination:

**Rationale**:
- Coordinated buying indicates accumulation or pump setup
- SELL coordination is less actionable for copy-trading
- Reduces noise from profit-taking or portfolio rebalancing

**Example**:
```
Token XYZ purchases in window [10:00, 10:05):
  • Wallet A: BUY 1000 XYZ at 10:01:00  ✅ Counted
  • Wallet B: BUY 500 XYZ at 10:02:30   ✅ Counted
  • Wallet C: SELL 200 XYZ at 10:03:00  ❌ Not counted
  • Wallet D: BUY 750 XYZ at 10:03:45   ✅ Counted
  • Wallet A: BUY 200 XYZ at 10:04:15   ❌ Already counted (A is not unique)

Unique buying wallets: A, B, D → Count = 3
```

### 3.3 Multiple Purchases by Same Wallet

If a wallet makes **multiple BUY transactions** of the same token within the window, it is **counted only once**:

```typescript
// Prisma's distinct: ["walletAddress"] ensures uniqueness
const buyers = await prisma.transferEvent.findMany({
  where: { /* ... */ },
  distinct: ["walletAddress"]  // De-duplicates by wallet
});
```

**Example**:
```
Wallet "ABC...123" buys Token XYZ:
  • 10:01:00 → BUY 500 XYZ
  • 10:02:15 → BUY 300 XYZ
  • 10:03:30 → BUY 1000 XYZ

Result: Wallet "ABC...123" is counted ONCE
```

### 3.4 Tracking Only Specific Wallets

The system only processes transfers from **tracked wallets** defined in `wallets.json`:

```json
// src/wallets.json (example)
[
  "13YTpv3ah9Aym4QpfpDK9MfH9tGmhM4nrDBDfGSBKybo",
  "25CxAp9DM2KnpjwCEePvE6Yex6y7HHGJgsQxyoo9j51L",
  "27hEdTBcXMPS4haZYbqmB95n8GD6XxrJEjQRZxcrKmPw"
  // ... 100 total tracked wallets
]
```

**Implications**:
- Only these wallets contribute to coordination count
- Other market participants are invisible to the system
- Coordinated trade alerts indicate activity among **influential wallets only**

### 3.5 Wallet Counting Edge Cases

#### Case 1: Wallet Buys Multiple Tokens
```
Wallet A in window [10:00, 10:05):
  • 10:01 → BUY Token X
  • 10:02 → BUY Token Y
  • 10:03 → BUY Token X (again)

For Token X: Wallet A counted once
For Token Y: Wallet A counted once
→ Two separate coordination checks
```

#### Case 2: Wallet Buys Then Sells
```
Wallet A:
  • 10:01 → BUY 1000 Token X
  • 10:03 → SELL 500 Token X

For coordination: Wallet A counted (BUY exists in window)
SELL is ignored in counting
```

#### Case 3: Zero Buys in Window
```
Window [10:00, 10:05):
  • No BUY transactions for Token X
  
Result: uniqueWallets.length = 0
→ Threshold not met, no alert
```

---

## 4. Threshold Configuration

### 4.1 Coordination Threshold

The **minimum number of unique wallets** required to trigger an alert:

```bash
# Environment variable
COORDINATED_MIN_WALLETS=5
```

```typescript
// Runtime configuration
const config = getConfig();
if (uniqueWallets.length >= config.coordinatedMinWallets) {
  // Trigger alert
  await createCoordinatedTrade(...);
}
```

### 4.2 Threshold Selection Guidelines

| Threshold | Sensitivity | False Positives | Use Case |
|-----------|-------------|-----------------|----------|
| **2** | Very high | Many | Experimental, high-frequency signals |
| **3** | High | Moderate | Aggressive copy-trading |
| **5** (default) | Moderate | Low | Balanced approach |
| **7** | Low | Very low | Conservative, high-confidence only |
| **10+** | Very low | Minimal | Rare, large-scale coordination |

### 4.3 Threshold Calculation Examples

**Scenario**: 10 tracked wallets total, 5-minute window

| Unique Buyers | Threshold=3 | Threshold=5 | Threshold=7 |
|---------------|-------------|-------------|-------------|
| 2 | ❌ No alert | ❌ No alert | ❌ No alert |
| 3 | ✅ **ALERT** | ❌ No alert | ❌ No alert |
| 5 | ✅ **ALERT** | ✅ **ALERT** | ❌ No alert |
| 7 | ✅ **ALERT** | ✅ **ALERT** | ✅ **ALERT** |
| 10 | ✅ **ALERT** | ✅ **ALERT** | ✅ **ALERT** |

### 4.4 Statistical Significance

With 100 tracked wallets:
- **Random chance of 5 buying same token in 5 minutes**: Very low (<1%)
- **Random chance of 10 buying same token**: Extremely low (<0.01%)

Higher thresholds = Higher confidence in actual coordination vs. random activity.

### 4.5 Dynamic Threshold Adjustment

The threshold can be **updated at runtime** without restart:

```bash
# Update via API
curl -X PATCH http://localhost:8080/config \
  -H "Content-Type: application/json" \
  -d '{"coordinatedMinWallets": 7}'
```

Changes apply immediately to both webhook and background scanner.

---

## 5. Deduplication Strategy

### 5.1 Why Deduplication Matters

Without deduplication, the same coordination pattern would trigger **multiple alerts**:

```
Problem (without deduplication):
  10:01 → Wallet A buys Token X (3 wallets now) → Alert 1
  10:02 → Wallet B buys Token X (4 wallets now) → Alert 2
  10:03 → Wallet C buys Token X (5 wallets now) → Alert 3
  Background scan at 10:03:30 → Alert 4
  Background scan at 10:04:00 → Alert 5
  
Result: 5 alerts for the SAME coordination event
```

### 5.2 Database-Level Deduplication

The system uses a **unique constraint** to prevent duplicate alerts:

```prisma
// prisma/schema.prisma
model CoordinatedTrade {
  id                String   @id @default(cuid())
  tokenAddress      String
  windowStart       DateTime
  windowEnd         DateTime
  triggeredAt       DateTime
  uniqueWalletCount Int
  walletAddresses   String

  @@unique([tokenAddress, windowStart], name: "token_window_unique")
  // ↑ Prevents duplicate records for same token + window
}
```

### 5.3 Check Before Insert

Before creating an alert, the system checks if it already exists:

```typescript
// Check if already processed
const existing = await prisma.coordinatedTrade.findFirst({
  where: { tokenAddress, windowStart },
  select: { id: true }
});

if (existing) {
  Logger.debug("Token already processed for window", { tokenAddress, windowStart });
  return; // Skip, don't create duplicate
}

// Only create if not exists
const coordinatedTrade = await prisma.coordinatedTrade.create({
  data: {
    tokenAddress,
    windowStart,
    windowEnd,
    triggeredAt,
    uniqueWalletCount,
    walletAddresses: JSON.stringify(uniqueWallets)
  }
});
```

### 5.4 Deduplication Across Detection Paths

Both detection paths (webhook + background) check the same database:

```
Scenario: Token X coordination detected

Path 1 (Webhook at 10:03:47):
  1. Check database → Not found
  2. Create alert → SUCCESS
  3. Broadcast to SSE

Path 2 (Background scan at 10:04:00):
  1. Check database → FOUND (from Path 1)
  2. Skip → No duplicate alert
  3. No broadcast

Path 2 (Background scan at 10:04:30):
  1. Check database → FOUND
  2. Skip → No duplicate alert
```

**Result**: Only **one alert per token per window**, regardless of how many times the pattern is detected.

### 5.5 Multi-Window Behavior

The same token CAN trigger alerts in **different windows**:

```
Token XYZ coordination:

Window 1 [10:00, 10:05):
  • 5 wallets buy → Alert created ✅

Window 2 [10:05, 10:10):
  • 6 wallets buy → Alert created ✅ (different window)

Window 3 [10:10, 10:15):
  • 4 wallets buy → No alert (below threshold)
```

This is **intentional**: sustained coordination across multiple windows is valuable information.

### 5.6 Deduplication Keys

| Deduplication Level | Key | Implementation |
|---------------------|-----|----------------|
| **Transfer Events** | `walletAddress + tokenAddress + signature` | Unique constraint in TransferEvent table |
| **Coordination Alerts** | `tokenAddress + windowStart` | Unique constraint in CoordinatedTrade table |
| **SSE Broadcasts** | None (idempotent, duplicates acceptable) | No deduplication needed |

---

## 6. Output Format for Trading Module

### 6.1 Coordinated Trade Event Schema

When coordination is detected, the trading module receives this event:

```typescript
interface CoordinatedTradeEvent {
  tokenAddress: string;          // Solana token mint address (44 chars)
  windowStart: string;            // ISO 8601 timestamp
  windowEnd: string;              // ISO 8601 timestamp
  triggeredAt: string;            // ISO 8601 timestamp (when detected)
  uniqueWalletCount: number;      // Number of unique buying wallets
  walletAddresses: string[];      // Array of wallet addresses (sorted)
}
```

### 6.2 Example Event (JSON)

```json
{
  "tokenAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "windowStart": "2025-11-08T10:00:00.000Z",
  "windowEnd": "2025-11-08T10:05:00.000Z",
  "triggeredAt": "2025-11-08T10:03:47.234Z",
  "uniqueWalletCount": 8,
  "walletAddresses": [
    "13YTpv3ah9Aym4QpfpDK9MfH9tGmhM4nrDBDfGSBKybo",
    "25CxAp9DM2KnpjwCEePvE6Yex6y7HHGJgsQxyoo9j51L",
    "27hEdTBcXMPS4haZYbqmB95n8GD6XxrJEjQRZxcrKmPw",
    "2WaTFaeUie1jUG3sj7Nv9ZLxeGpnuWZCFpTrreubcN2c",
    "2wpRjDFVnBjyKAA3aht1WcJmmXdZiaMuJj6UHrJjBxsi",
    "2yaQNULHJyXzcjsJwbkEy3gFHSEEC4q2wy89uho7E93G",
    "36ECGsRdMws1g7xpHFDdn2uSvogNFG9nPUk9NmrW9m2D",
    "3ascXfLsWrXe3F9MoQJjuigGH5w9evcaMhqPEjzCBTsr"
  ]
}
```

### 6.3 Field Descriptions

| Field | Type | Description | Usage in Trading Module |
|-------|------|-------------|-------------------------|
| `tokenAddress` | string | Solana SPL token mint address | **Primary action field**: Token to analyze/trade |
| `windowStart` | ISO 8601 | Start of detection window | Context: when coordination began |
| `windowEnd` | ISO 8601 | End of detection window | Context: window boundary |
| `triggeredAt` | ISO 8601 | Exact moment alert was generated | Latency calculation: `now - triggeredAt` |
| `uniqueWalletCount` | number | Count of unique buying wallets | **Signal strength**: Higher = stronger signal |
| `walletAddresses` | string[] | List of participating wallets | Analysis: check wallet reputation, history |

### 6.4 Receiving Events via SSE

```javascript
// Trading Module - SSE Client Implementation
const EventSource = require('eventsource');

const eventSource = new EventSource('http://wallet-tracker:8080/stream/coordinated');

eventSource.addEventListener('message', (event) => {
  const coordinatedTrade = JSON.parse(event.data);
  
  console.log(`🚨 COORDINATION DETECTED`);
  console.log(`Token: ${coordinatedTrade.tokenAddress}`);
  console.log(`Wallets: ${coordinatedTrade.uniqueWalletCount}`);
  console.log(`Triggered: ${coordinatedTrade.triggeredAt}`);
  
  // Trading logic here
  handleCoordinatedTrade(coordinatedTrade);
});

eventSource.addEventListener('error', (error) => {
  console.error('SSE connection error:', error);
  // Reconnect logic
});

async function handleCoordinatedTrade(trade) {
  // 1. Validate token address
  if (!isValidSolanaAddress(trade.tokenAddress)) return;
  
  // 2. Check signal strength
  if (trade.uniqueWalletCount < 5) return; // Local threshold
  
  // 3. Check wallet reputation
  const reputationScore = await checkWalletReputation(trade.walletAddresses);
  if (reputationScore < 0.7) return;
  
  // 4. Fetch token metadata
  const tokenInfo = await getTokenInfo(trade.tokenAddress);
  
  // 5. Check liquidity
  const liquidity = await getTokenLiquidity(trade.tokenAddress);
  if (liquidity < MIN_LIQUIDITY) return;
  
  // 6. Calculate position size
  const positionSize = calculatePositionSize(
    trade.uniqueWalletCount,
    reputationScore,
    liquidity
  );
  
  // 7. Execute trade
  await executeBuyOrder(trade.tokenAddress, positionSize);
  
  // 8. Monitor for exit signals
  monitorPosition(trade.tokenAddress, trade.walletAddresses);
}
```

### 6.5 Alternative: REST API Polling

For trading modules that prefer polling:

```javascript
// Poll for recent coordinated trades
async function pollCoordinatedTrades() {
  const response = await fetch('http://wallet-tracker:8080/dev/db/coordinated?limit=10');
  const trades = await response.json();
  
  for (const trade of trades) {
    // Check if already processed
    if (processedTradeIds.has(trade.id)) continue;
    
    // Process new trade
    await handleCoordinatedTrade({
      tokenAddress: trade.tokenAddress,
      windowStart: trade.windowStart,
      windowEnd: trade.windowEnd,
      triggeredAt: trade.triggeredAt,
      uniqueWalletCount: trade.uniqueWalletCount,
      walletAddresses: JSON.parse(trade.walletAddresses)
    });
    
    processedTradeIds.add(trade.id);
  }
}

// Poll every 10 seconds
setInterval(pollCoordinatedTrades, 10000);
```

### 6.6 Trading Decision Matrix

Use the event data to make informed trading decisions:

| Unique Wallets | Action | Rationale |
|----------------|--------|-----------|
| 3-4 | Monitor | Low confidence, watch for more activity |
| 5-7 | Small position | Moderate confidence, take small position |
| 8-10 | Medium position | Strong signal, standard position |
| 10+ | Large position | Very strong signal, aggressive position |

Adjust based on:
- **Wallet reputation**: Known successful wallets = higher confidence
- **Token liquidity**: Higher liquidity = safer to trade
- **Market conditions**: Bull market = more aggressive, bear = conservative
- **Historical pattern success rate**: Track your own metrics

### 6.7 Latency Considerations

```
Event Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Blockchain: Wallet executes BUY transaction
            │
            ├─▶ 1-2 seconds: Transaction confirmed
            │
Helius:     ├─▶ <1 second: Webhook sent
            │
Tracker:    ├─▶ <100ms: Webhook processed
            │   ├─▶ Parse, dedupe, save
            │   └─▶ Check coordination
            │
            ├─▶ <50ms: Alert broadcast (if threshold met)
            │
Trading:    ├─▶ <100ms: SSE event received
            │
            └─▶ 500ms-2s: Analysis + trade execution

Total Latency: ~2-5 seconds from blockchain to trading execution
```

**Optimization tips**:
- Use SSE (not polling) for lowest latency
- Pre-fetch token metadata for tracked tokens
- Have position sizing logic pre-calculated
- Use async/parallel analysis where possible

### 6.8 Error Handling in Trading Module

```javascript
eventSource.addEventListener('message', async (event) => {
  try {
    const trade = JSON.parse(event.data);
    
    // Validate schema
    if (!validateCoordinatedTradeSchema(trade)) {
      throw new Error('Invalid event schema');
    }
    
    // Process with timeout
    await Promise.race([
      handleCoordinatedTrade(trade),
      timeout(5000) // 5 second timeout
    ]);
    
  } catch (error) {
    console.error('Failed to process coordinated trade:', error);
    // Don't crash, continue receiving events
    logError(error, { event: event.data });
  }
});

function validateCoordinatedTradeSchema(trade) {
  return (
    typeof trade.tokenAddress === 'string' &&
    trade.tokenAddress.length === 44 && // Solana address length
    typeof trade.uniqueWalletCount === 'number' &&
    Array.isArray(trade.walletAddresses) &&
    trade.walletAddresses.length === trade.uniqueWalletCount
  );
}
```

### 6.9 Monitoring Coordination Quality

Track metrics in your trading module:

```javascript
const metrics = {
  totalAlertsReceived: 0,
  alertsActedOn: 0,
  successfulTrades: 0,
  unsuccessfulTrades: 0,
  averageLatency: 0,
  
  recordAlert(trade) {
    this.totalAlertsReceived++;
    const latency = Date.now() - new Date(trade.triggeredAt).getTime();
    this.averageLatency = (this.averageLatency * (this.totalAlertsReceived - 1) + latency) / this.totalAlertsReceived;
  },
  
  recordTradeResult(trade, success) {
    this.alertsActedOn++;
    if (success) {
      this.successfulTrades++;
    } else {
      this.unsuccessfulTrades++;
    }
  },
  
  getSuccessRate() {
    return this.successfulTrades / this.alertsActedOn;
  }
};
```

Use these metrics to:
- Adjust threshold dynamically
- Filter by wallet reputation
- Optimize position sizing
- Evaluate system effectiveness

---

## 7. Algorithm Performance Characteristics

### 7.1 Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Window calculation | O(1) | Simple arithmetic |
| Find candidate tokens | O(n) | n = transfer events in window |
| Count unique wallets per token | O(m) | m = transfers for specific token |
| Deduplication check | O(1) | Indexed database lookup |
| Overall per webhook | O(n + k*m) | k = number of candidate tokens |

### 7.2 Space Complexity

| Data Structure | Space | Growth Rate |
|----------------|-------|-------------|
| TransferEvent table | ~200 bytes/event | Linear with transaction volume |
| CoordinatedTrade table | ~150 bytes/alert | Sparse (only coordinated events) |
| SSE client list | ~1KB/client | Fixed (max concurrent clients) |

### 7.3 Database Query Performance

**Indexed Queries** (Fast):
```sql
-- Find tokens with BUY activity (uses tokenAddress + timestamp index)
SELECT DISTINCT tokenAddress FROM TransferEvent 
WHERE side = 'BUY' AND timestamp >= ? AND timestamp < ?;

-- Count unique wallets (uses tokenAddress + timestamp index)
SELECT DISTINCT walletAddress FROM TransferEvent
WHERE tokenAddress = ? AND side = 'BUY' 
  AND timestamp >= ? AND timestamp < ?;

-- Check existing alert (uses unique constraint index)
SELECT id FROM CoordinatedTrade
WHERE tokenAddress = ? AND windowStart = ?;
```

**Query Times** (typical):
- Find candidate tokens: <10ms
- Count unique wallets: <5ms
- Deduplication check: <1ms

---

## 8. Configuration Best Practices

### 8.1 Recommended Settings

**Production (Conservative)**:
```bash
COORDINATED_WINDOW_MINUTES=5
COORDINATED_MIN_WALLETS=5
EXCLUDE_TOKENS="So11111111111111111111111111111111111111112"
MIN_AMOUNT=1
```

**Aggressive Trading**:
```bash
COORDINATED_WINDOW_MINUTES=3
COORDINATED_MIN_WALLETS=3
EXCLUDE_TOKENS="So11111111111111111111111111111111111111112"
MIN_AMOUNT=10
```

**Research/Analysis**:
```bash
COORDINATED_WINDOW_MINUTES=10
COORDINATED_MIN_WALLETS=2
EXCLUDE_TOKENS=""
MIN_AMOUNT=0.1
```

### 8.2 Tuning Guidelines

1. **Start conservative**: High threshold, longer window
2. **Monitor false positive rate**: Adjust threshold down if missing opportunities
3. **Track success rate**: If coordination alerts don't lead to profitable trades, increase threshold
4. **Consider market conditions**: Bull market → lower threshold, Bear market → higher threshold

---

## Next Steps

- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Step-by-step integration with trading module
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete API documentation
- **[DATA_MODELS.md](./DATA_MODELS.md)** - Detailed data structure specifications

---

**Document Version**: 1.0  
**Last Updated**: November 8, 2025  
**Author**: System Documentation  
**Status**: Production Ready
