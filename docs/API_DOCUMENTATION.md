# API Documentation for Frontend Developers

## Base URL
```
http://localhost:3000
```
Replace with your production domain when deployed.

---

## Table of Contents
- [Authentication](#authentication)
- [Health Check](#health-check)
- [Configuration Management](#configuration-management)
- [Webhook Endpoint](#webhook-endpoint-internal)
- [Real-time Streaming (SSE)](#real-time-streaming-sse)
- [Database Schema](#database-schema)
- [Static Files](#static-files)
- [Development Endpoints](#development-endpoints-optional)
- [Error Responses](#error-responses)
- [Security & Authentication Details](#security--authentication-details)

---

## Authentication

### Login
Authenticate and receive a JWT token.

**Endpoint:** `POST /api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "username": "admin",
    "role": "admin"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing username or password
```json
{
  "error": "Username and password are required"
}
```

- `401 Unauthorized` - Invalid credentials
```json
{
  "error": "Invalid credentials"
}
```

**Usage Example:**
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'your-password'
  })
});

const data = await response.json();
if (data.ok) {
  localStorage.setItem('token', data.token);
}
```

---

### Get Current User
Retrieve information about the currently authenticated user.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "user": {
    "id": "1",
    "username": "admin",
    "role": "admin"
  }
}
```

**Error Response:**
- `401 Unauthorized` - Invalid or missing token
```json
{
  "error": "Not authenticated"
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
```

---

### Logout
Logout the current user (client-side token removal).

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
await fetch('http://localhost:3000/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

localStorage.removeItem('token');
```

---

## Health Check

### Check API Health
Check if the API server is running properly.

**Endpoint:** `GET /health`

**Headers:** None required

**Success Response (200 OK):**
```json
{
  "ok": true,
  "timestamp": "2026-01-10T12:34:56.789Z",
  "environment": "development"
}
```

**Usage Example:**
```javascript
const response = await fetch('http://localhost:3000/health');
const status = await response.json();
console.log('API is', status.ok ? 'healthy' : 'down');
```

---

## Configuration Management

All configuration endpoints require JWT authentication.

### Get Current Configuration
Retrieve the current system configuration.

**Endpoint:** `GET /config`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "excludeTokens": [
    "So11111111111111111111111111111111111111112"
  ],
  "minAmount": 1,
  "dedupBySignatureOnly": false,
  "coordinatedWindowMinutes": 5,
  "coordinatedMinWallets": 5,
  "debugEvents": false,
  "debugEventsVerbose": false
}
```

**Configuration Fields:**
- `excludeTokens` (string[]): Token addresses to exclude from tracking
- `minAmount` (number): Minimum transfer amount threshold (default: 1)
- `dedupBySignatureOnly` (boolean): Deduplicate events by signature only (default: false)
- `coordinatedWindowMinutes` (number): Time window for coordinated trade detection (default: 5)
- `coordinatedMinWallets` (number): Minimum wallets for coordinated trade alert (default: 5)
- `debugEvents` (boolean): Enable debug event logging (default: false)
- `debugEventsVerbose` (boolean): Enable verbose debug logging (default: false)

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/config', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const config = await response.json();
console.log('Window:', config.coordinatedWindowMinutes, 'minutes');
console.log('Min wallets:', config.coordinatedMinWallets);
```

---

### Update Configuration
Update system configuration parameters.

**Endpoint:** `PATCH /config`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "coordinatedWindowMinutes": 10,
  "coordinatedMinWallets": 5,
  "minAmount": 10,
  "debugEvents": true
}
```

You can update any combination of these fields:

- `excludeTokens` (string[]): Array of token addresses to exclude from tracking
- `minAmount` (number, min: 0): Minimum transfer amount threshold to process events
- `dedupBySignatureOnly` (boolean): If true, deduplicates events by signature only; if false, uses wallet+token+signature
- `coordinatedWindowMinutes` (number, min: 1): Time window in minutes for detecting coordinated trades
- `coordinatedMinWallets` (number, min: 1): Minimum number of unique wallets required to trigger a coordinated trade alert
- `debugEvents` (boolean): Enable debug logging for all processed events
- `debugEventsVerbose` (boolean): Enable verbose debug logging with full event details

**Success Response (200 OK):**
```json
{
  "excludeTokens": [
    "So11111111111111111111111111111111111111112"
  ],
  "minAmount": 10,
  "dedupBySignatureOnly": false,
  "coordinatedWindowMinutes": 10,
  "coordinatedMinWallets": 5,
  "debugEvents": true,
  "debugEventsVerbose": false
}
```

**Error Response:**
- `400 Bad Request` - Invalid configuration
```json
{
  "error": "Invalid config"
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');

// Update multiple configuration settings
const response = await fetch('http://localhost:3000/config', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    coordinatedWindowMinutes: 10,
    coordinatedMinWallets: 5,
    minAmount: 100,
    debugEvents: true
  })
});

const updatedConfig = await response.json();
console.log('Updated config:', updatedConfig);

// Or update a single field
const response2 = await fetch('http://localhost:3000/config', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    minAmount: 50
  })
});

const config = await response2.json();
```

---

### Get Excluded Tokens
Retrieve the list of excluded token addresses.

**Endpoint:** `GET /config/exclude-tokens`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "excludeTokens": [
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  ]
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/config/exclude-tokens', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const data = await response.json();
console.log('Excluded tokens:', data.excludeTokens);
```

---

### Add Token to Exclude List
Add a token address to the exclude list.

**Endpoint:** `POST /config/exclude-tokens`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "tokenAddress": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
}
```

**Success Response (200 OK):**
```json
{
  "message": "Token added to exclude list",
  "excludeTokens": [
    "So11111111111111111111111111111111111111112",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  ]
}
```

**Response if token already exists:**
```json
{
  "message": "Token already in exclude list",
  "excludeTokens": [
    "So11111111111111111111111111111111111111112"
  ]
}
```

**Error Response:**
- `400 Bad Request` - Missing or invalid token address
```json
{
  "error": "tokenAddress is required and must be a string"
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/config/exclude-tokens', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tokenAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  })
});

const result = await response.json();
console.log(result.message);
```

---

### Remove Token from Exclude List
Remove a token address from the exclude list.

**Endpoint:** `DELETE /config/exclude-tokens/:tokenAddress`

**URL Parameters:**
- `tokenAddress` (string): The token address to remove

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "message": "Token removed from exclude list",
  "excludeTokens": [
    "So11111111111111111111111111111111111111112"
  ]
}
```

**Response if token not found:**
```json
{
  "message": "Token not found in exclude list",
  "excludeTokens": [
    "So11111111111111111111111111111111111111112"
  ]
}
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const tokenToRemove = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const response = await fetch(`http://localhost:3000/config/exclude-tokens/${tokenToRemove}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
console.log(result.message);
```

---

## Webhook Endpoint (Internal)

**⚠️ Note:** This endpoint is for internal use by Helius webhooks. Frontend applications should use the Real-time Streaming (SSE) endpoints to receive processed data.

### Receive Helius Webhook Events
Receives transaction events from Helius webhook service, processes them, and stores them in the database.

**Endpoint:** `POST /helius`

**Authentication:** Requires `x-helius-secret` header or `Authorization` header with the webhook secret

**Headers:**
```
Content-Type: application/json
x-helius-secret: <your-webhook-secret>
```

**OR**

```
Content-Type: application/json
Authorization: Bearer <your-webhook-secret>
```

**Request Body:**
Helius enhanced webhook payload (array of transaction events)

```json
[
  {
    "type": "ENHANCED_TRANSACTION",
    "signature": "5J8dHPpxqvZm2qN3GkFdYLpRt7WKs9hXbV4QjZ8mPnL2...",
    "timestamp": 1704902096,
    "tokenTransfers": [
      {
        "fromUserAccount": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        "toUserAccount": "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "tokenAmount": 1000000
      }
    ],
    "nativeTransfers": []
  }
]
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "accepted": true
}
```

**Response Details:**
- The endpoint responds immediately with 200 OK to prevent webhook timeout
- Processing happens asynchronously in the background
- Parsed transfers are saved to the database
- Events are broadcast via SSE streams to connected clients
- Coordinated trade detection runs after processing

**Error Response:**
- `401 Unauthorized` - Invalid or missing webhook secret
```json
{
  "error": "Unauthorized"
}
```

**Processing Flow:**
1. Webhook received and validated
2. Immediate 200 OK response sent to Helius
3. Background processing:
   - Parse Helius events for tracked wallets
   - Filter by excluded tokens and minimum amount
   - Deduplicate against existing database records
   - Save new transfers to database
   - Broadcast via SSE to connected clients
   - Check for coordinated trading patterns
   - Broadcast coordinated trades if detected

**Webhook Configuration:**
- Set `WEBHOOK_SECRET` environment variable to match your Helius webhook secret
- Configure Helius webhook to point to: `https://your-domain.com/helius`
- Use "Enhanced" webhook type for best results

---

## Real-time Streaming (SSE)

The API provides Server-Sent Events (SSE) endpoints for real-time data streaming. These endpoints do not require authentication.

### Stream Transfer Events
Receive real-time transfer (buy/sell) events as they are processed from Helius webhooks.

**Endpoint:** `GET /stream/transfers`

**Protocol:** Server-Sent Events (SSE) / text/event-stream

**Authentication:** None required (public endpoint)

**Headers:** None required

**Connection:** Long-lived HTTP connection with automatic reconnection support

**Event Data Format:**
```json
[
  {
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000",
    "signature": "5J8dHPpxqvZ...",
    "timestamp": "2026-01-10T12:34:56.789Z",
    "side": "BUY"
  }
]
```

**Fields:**
- `walletAddress` (string): Solana wallet address
- `tokenAddress` (string): Token contract address
- `amount` (string): Transfer amount as string
- `signature` (string): Transaction signature
- `timestamp` (string): ISO 8601 timestamp
- `side` (string): Either "BUY" or "SELL"

**Usage Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/stream/transfers');

eventSource.onmessage = (event) => {
  const transfers = JSON.parse(event.data);
  console.log('New transfers:', transfers);
  
  transfers.forEach(transfer => {
    console.log(`${transfer.side}: ${transfer.amount} tokens by ${transfer.walletAddress}`);
  });
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};

// To stop receiving events:
// eventSource.close();
```

---

### Stream Coordinated Trade Events
Receive real-time coordinated trade detection events when multiple wallets buy the same token within a time window.

**Endpoint:** `GET /stream/coordinated`

**Protocol:** Server-Sent Events (SSE) / text/event-stream

**Authentication:** None required (public endpoint)

**Headers:** None required

**Trigger Conditions:**
- Minimum wallets: Configurable via `coordinatedMinWallets` (default: 5)
- Time window: Configurable via `coordinatedWindowMinutes` (default: 5 minutes)
- Only BUY transactions are counted
- Excluded tokens are ignored

**Event Data Format:**
```json
{
  "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "windowStart": "2026-01-10T12:30:00.000Z",
  "windowEnd": "2026-01-10T12:35:00.000Z",
  "triggeredAt": "2026-01-10T12:35:01.234Z",
  "uniqueWalletCount": 5,
  "walletAddresses": [
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i",
    "2h4Uj5k9KVKM7YGfjdMFwFBSvdRVj7HJgPKH8xYXN2JA"
  ]
}
```

**Fields:**
- `tokenAddress` (string): Token that had coordinated activity
- `windowStart` (string): Start of the detection window (ISO 8601)
- `windowEnd` (string): End of the detection window (ISO 8601)
- `triggeredAt` (string): When the alert was triggered (ISO 8601)
- `uniqueWalletCount` (number): Number of unique wallets involved
- `walletAddresses` (string[]): Array of wallet addresses involved

**Usage Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/stream/coordinated');

eventSource.onmessage = (event) => {
  const coordinated = JSON.parse(event.data);
  console.log('Coordinated trade detected!', coordinated);
  
  // Show alert to user
  showAlert(`${coordinated.uniqueWalletCount} wallets traded ${coordinated.tokenAddress} together!`);
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

---

### Stream All Events (Combined)
Receive both transfer and coordinated trade events in a single stream with named events. More efficient than opening two separate connections.

**Endpoint:** `GET /stream/all`

**Protocol:** Server-Sent Events (SSE) / text/event-stream

**Authentication:** None required (public endpoint)

**Headers:** None required

**Connection Details:**
- Keep-alive: 15-second heartbeat (`: keepalive\n\n`)
- Automatic buffering prevention headers set
- Graceful cleanup on client disconnect

**Events:**
- Event name: `transfers` - Contains transfer data (same format as /stream/transfers)
- Event name: `coordinated` - Contains coordinated trade data (same format as /stream/coordinated)

**Usage Example:**
```javascript
const eventSource = new EventSource('http://localhost:3000/stream/all');

// Listen for transfer events
eventSource.addEventListener('transfers', (event) => {
  const transfers = JSON.parse(event.data);
  console.log('New transfers:', transfers);
  updateTransferUI(transfers);
});

// Listen for coordinated trade events
eventSource.addEventListener('coordinated', (event) => {
  const coordinated = JSON.parse(event.data);
  console.log('Coordinated trade detected:', coordinated);
  showCoordinatedAlert(coordinated);
});

// Handle connection errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  // Optionally reconnect after delay
  setTimeout(() => {
    eventSource.close();
    // reconnect logic here
  }, 5000);
};

// Clean up when component unmounts
function cleanup() {
  eventSource.close();
}
```

---

## Database Schema

The system uses PostgreSQL with TimescaleDB extensions for time-series data storage. Understanding the database schema helps frontend developers interpret the data structure returned by various endpoints.

### Database Tables

#### TransferEvent Table
Stores individual token transfer events (buy/sell transactions).

**Schema:**
```typescript
{
  id: string;              // Unique identifier (CUID)
  walletAddress: string;   // Solana wallet address (44 characters)
  tokenAddress: string;    // SPL token mint address (44 characters)
  amount: string;          // Transfer amount (stored as string for precision)
  signature: string;       // Solana transaction signature (88+ characters)
  timestamp: Date;         // Transaction timestamp (ISO 8601)
  side: "BUY" | "SELL";   // Transaction direction
}
```

**Indexes:**
- `wallet_token_sig_unique`: Unique constraint on (walletAddress, tokenAddress, signature)
- Index on (walletAddress, timestamp) - for wallet activity queries
- Index on (tokenAddress, timestamp) - for token activity queries
- Index on (signature) - for transaction lookups

**Example Record:**
```json
{
  "id": "clx1a2b3c4d5e6f7g8h9i0j1k",
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "1000000",
  "signature": "5J8dHPpxqvZm2qN3GkFdYLpRt7WKs9hXbV4QjZ8mPnL2...",
  "timestamp": "2026-01-10T12:34:56.789Z",
  "side": "BUY"
}
```

---

#### CoordinatedTrade Table
Stores detected coordinated trading events when multiple wallets trade the same token within a time window.

**Schema:**
```typescript
{
  id: string;                  // Unique identifier (CUID)
  tokenAddress: string;        // Token that was traded
  windowStart: Date;           // Start of detection window (inclusive)
  windowEnd: Date;             // End of detection window (exclusive)
  triggeredAt: Date;           // When the alert was triggered
  uniqueWalletCount: number;   // Number of unique wallets involved
  walletAddresses: string;     // JSON string array of wallet addresses
}
```

**Indexes:**
- Index on (tokenAddress, windowStart) - for token-specific queries
- `token_window_unique`: Unique constraint on (tokenAddress, windowStart)

**Example Record:**
```json
{
  "id": "clx2b3c4d5e6f7g8h9i0j1k2l",
  "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "windowStart": "2026-01-10T12:30:00.000Z",
  "windowEnd": "2026-01-10T12:35:00.000Z",
  "triggeredAt": "2026-01-10T12:35:01.234Z",
  "uniqueWalletCount": 5,
  "walletAddresses": "[\"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\",\"9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i\",\"2h4Uj5k9KVKM7YGfjdMFwFBSvdRVj7HJgPKH8xYXN2JA\",\"4k9Lp2mNqRst8UvWxYz5AbCdEfGhIjKlMnOpQrStUvWx\",\"6nPqRsTuVwXyZ1aBcDeFgHiJkLmNoPqRsTuVwXyZ1AbC\"]"
}
```

**Note on walletAddresses Field:**
- Stored as a JSON string in the database
- When retrieved via development endpoints, it's returned as a string
- When broadcast via SSE streams, it's parsed and sent as an array
- Frontend should parse it if received as string: `JSON.parse(walletAddresses)`

---

### Database Configuration

**Database Type:** PostgreSQL 14+ with TimescaleDB extension

**Connection:**
- Primary: Use `DATABASE_URL` environment variable
- Direct: Use `DIRECT_URL` for migrations and connection pooling bypass

**Time-Series Optimization:**
TimescaleDB is used for:
- Efficient time-based queries on TransferEvent table
- Automatic data compression for older records
- Hypertable configuration for better performance on large datasets

---

### Data Flow

1. **Webhook Ingestion** → TransferEvent records created
2. **Background Scanner** → Analyzes TransferEvent within time windows
3. **Detection** → CoordinatedTrade records created when threshold met
4. **Real-time Broadcast** → SSE streams push to connected clients

```
Helius Webhook → /helius endpoint → Database (TransferEvent)
                                         ↓
                            Background Scanner (every 30s)
                                         ↓
                            Database (CoordinatedTrade)
                                         ↓
                            SSE Streams → Frontend Clients
```

---

### Common Token Addresses

These addresses frequently appear in the data:

| Token | Address | Description |
|-------|---------|-------------|
| SOL (Wrapped) | `So11111111111111111111111111111111111111112` | Wrapped Solana |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | USD Coin |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | Tether USD |

**Note:** These tokens are typically in the exclude list by default as they're used for liquidity and don't indicate coordinated trading patterns.

---

### Data Retention

**Current Setup:**
- No automatic deletion (all data retained)
- Manual cleanup via database queries if needed
- Consider implementing retention policies based on requirements

**Future Considerations:**
- Archive old TransferEvent records older than X days
- Keep CoordinatedTrade records indefinitely for historical analysis
- Implement database partitioning for better performance

---

## Static Files

The server serves static HTML files from the `/public` directory for testing and demo purposes.

**Available Pages:**

| Path | Description |
|------|-------------|
| `/` or `/index.html` | Main dashboard page |
| `/login.html` | Login page for authentication |
| `/test.html` | Basic connection test page |
| `/realtime-test.html` | SSE connection test page |
| `/coordinated-trades-live.html` | Live coordinated trades monitor |

**Access:**
```javascript
// Open in browser
window.open('http://localhost:3000/', '_blank');
window.open('http://localhost:3000/login.html', '_blank');
```

**Note:** These are example/demo pages. In production, you'll likely build your own frontend application that consumes the API endpoints.

---

## Development Endpoints (Optional)

These endpoints are only available when `ALLOW_DEV_ENDPOINTS=true` in environment variables. All require JWT authentication.

### Ping
Simple connectivity test endpoint.

**Endpoint:** `GET /dev/ping`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "ok": true,
  "now": "2026-01-10T12:34:56.789Z"
}
```

---

### Get Recent Transfers
Retrieve recent transfer events from the database. Returns the most recent transfers ordered by timestamp (descending).

**Endpoint:** `GET /dev/db/transfers?limit=50`

**Query Parameters:**
- `limit` (number, optional): Maximum number of records to return (default: 50, max: 1000)

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "clx1a2b3c4d5e6f7g8h9i0j1k",
    "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000",
    "signature": "5J8dHPpxqvZm2qN3GkFdYLpRt7WKs9hXbV4QjZ8mPnL2...",
    "timestamp": "2026-01-10T12:34:56.789Z",
    "side": "BUY"
  }
]
```

**Usage Example:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('http://localhost:3000/dev/db/transfers?limit=100', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const transfers = await response.json();
console.log(`Retrieved ${transfers.length} recent transfers`);
```

---

### Get Recent Coordinated Trades
Retrieve recent coordinated trade detections from the database.

**Endpoint:** `GET /dev/db/coordinated?limit=50`

**Query Parameters:**
- `limit` (number, optional): Maximum number of records to return (default: 50)

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "clx2b3c4d5e6f7g8h9i0j1k2l",
    "tokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "windowStart": "2026-01-10T12:30:00.000Z",
    "windowEnd": "2026-01-10T12:35:00.000Z",
    "triggeredAt": "2026-01-10T12:35:01.234Z",
    "uniqueWalletCount": 5,
    "walletAddresses": "[\"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\",\"9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i\"]"
  }
]
```

**Important:** The `walletAddresses` field is returned as a JSON string. Parse it to get the array:
```javascript
const trades = await response.json();
trades.forEach(trade => {
  trade.walletAddresses = JSON.parse(trade.walletAddresses);
  console.log('Wallets involved:', trade.walletAddresses);
});
```

---

### Get Database Statistics
Get total counts of transfers and coordinated trades.

**Endpoint:** `GET /dev/db/stats`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Success Response (200 OK):**
```json
{
  "transferCount": 12456,
  "coordinatedCount": 42
}
```

---

## Error Responses

### Standard Error Format
All API errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- **200 OK** - Request successful
- **400 Bad Request** - Invalid request parameters or body
- **401 Unauthorized** - Missing or invalid authentication token
- **404 Not Found** - Endpoint does not exist
- **500 Internal Server Error** - Server-side error

### Example Error Handling

```javascript
async function apiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error.message);
    throw error;
  }
}

// Usage
try {
  const config = await apiRequest('http://localhost:3000/config', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('Config:', config);
} catch (error) {
  alert('Failed to fetch configuration');
}
```

---

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS). Configure allowed origins using the `ALLOWED_ORIGINS` environment variable:

- `ALLOWED_ORIGINS=*` - Allow all origins (development only)
- `ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com` - Allow specific origins

**Allowed Methods:** GET, POST, PATCH, PUT, DELETE, OPTIONS

**Allowed Headers:** Content-Type, Authorization, x-helius-secret

---

## Complete Usage Example

Here's a complete example of building a simple dashboard:

```javascript
class WalletTrackerAPI {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('token');
  }

  // Authentication
  async login(username, password) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    if (data.ok) {
      this.token = data.token;
      localStorage.setItem('token', data.token);
    }
    return data;
  }

  async logout() {
    await fetch(`${this.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    this.token = null;
    localStorage.removeItem('token');
  }

  // Configuration
  async getConfig() {
    const response = await fetch(`${this.baseUrl}/config`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    return response.json();
  }

  async updateConfig(config) {
    const response = await fetch(`${this.baseUrl}/config`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    return response.json();
  }

  // Real-time streaming
  streamTransfers(onTransfer) {
    const eventSource = new EventSource(`${this.baseUrl}/stream/transfers`);
    eventSource.onmessage = (event) => {
      const transfers = JSON.parse(event.data);
      onTransfer(transfers);
    };
    return eventSource;
  }

  streamCoordinated(onCoordinated) {
    const eventSource = new EventSource(`${this.baseUrl}/stream/coordinated`);
    eventSource.onmessage = (event) => {
      const coordinated = JSON.parse(event.data);
      onCoordinated(coordinated);
    };
    return eventSource;
  }
}

// Usage
const api = new WalletTrackerAPI();

// Login
await api.login('admin', 'password');

// Get config
const config = await api.getConfig();
console.log('Current config:', config);

// Stream transfers
const transferStream = api.streamTransfers((transfers) => {
  transfers.forEach(t => {
    console.log(`${t.side}: ${t.amount} by ${t.walletAddress}`);
  });
});

// Stream coordinated trades
const coordinatedStream = api.streamCoordinated((coordinated) => {
  alert(`Coordinated trade: ${coordinated.uniqueWalletCount} wallets!`);
});

// Clean up when done
window.addEventListener('beforeunload', () => {
  transferStream.close();
  coordinatedStream.close();
});
```

---

## Notes for Frontend Developers

1. **Authentication**: Store the JWT token securely in localStorage or sessionStorage. Include it in the Authorization header for protected endpoints.

2. **SSE Reconnection**: EventSource will automatically reconnect on connection loss. Implement additional retry logic if needed.

3. **CORS**: Ensure your frontend domain is added to the `ALLOWED_ORIGINS` environment variable on the backend.

4. **Rate Limiting**: Currently no rate limiting is implemented. Consider implementing client-side throttling for SSE event handlers.

5. **Data Types**: 
   - All timestamps are ISO 8601 strings (e.g., `"2026-01-10T12:34:56.789Z"`)
   - Amount values are strings to preserve precision (use BigInt or decimal libraries for calculations)
   - Wallet and token addresses are 44-character base58 Solana addresses
   - Transaction signatures are 88+ character base58 strings

6. **Error Handling**: Always check response status and handle errors appropriately. Show user-friendly messages.

7. **Token Expiry**: JWT tokens expire after 24 hours. Implement token refresh logic or redirect to login when you receive 401 responses.

8. **WebSocket Alternative**: If SSE is not suitable for your use case, consider requesting WebSocket support from the backend team.

9. **Database Data Parsing**:
   - When fetching from `/dev/db/coordinated`, the `walletAddresses` field is a JSON string
   - SSE streams send `walletAddresses` as a parsed array
   - Always check the data type and parse if needed

10. **Amount Precision**: 
    - Amounts are stored as strings to avoid floating-point precision issues
    - When displaying to users, consider token decimals (most SPL tokens use 6-9 decimals)
    - Example: `"1000000"` with 6 decimals = 1.0 tokens

11. **Solana Explorer Links**: You can link to transaction signatures and addresses:
    - Transaction: `https://solscan.io/tx/${signature}`
    - Wallet: `https://solscan.io/account/${walletAddress}`
    - Token: `https://solscan.io/token/${tokenAddress}`

12. **Deduplication Strategy**: 
    - By default, deduplication uses wallet+token+signature combination
    - If `dedupBySignatureOnly` is enabled, only signature is used
    - This affects how duplicate transfers are filtered

13. **Coordinated Trade Detection**:
    - Only BUY transactions trigger coordinated trade detection
    - Detection runs asynchronously after webhook processing
    - Each token+window combination is only alerted once
    - Configure thresholds via `/config` endpoint

14. **Webhook Events**:
    - Webhook processing is asynchronous (fire-and-forget)
    - Frontend should rely on SSE streams for real-time data
    - Check `/dev/db/stats` to monitor total event counts

15. **SSE Connection Best Practices**:
    - Always implement error handlers
    - Close streams when component unmounts
    - Handle reconnection gracefully
    - Consider using `/stream/all` for efficiency instead of multiple streams

---

## Static Files

The server serves static HTML files from the `/public` directory for testing and demo purposes.

**Available Pages:**

| Path | Description |
|------|-------------|
| `/` or `/index.html` | Main dashboard page |
| `/login.html` | Login page for authentication |
| `/test.html` | Basic connection test page |
| `/realtime-test.html` | SSE connection test page |
| `/coordinated-trades-live.html` | Live coordinated trades monitor |

**Access:**
```javascript
// Open in browser
window.open('http://localhost:3000/', '_blank');
window.open('http://localhost:3000/login.html', '_blank');
```

**Note:** These are example/demo pages. In production, you'll likely build your own frontend application that consumes the API endpoints.

---

## Security & Authentication Details

### JWT Authentication

**Token Format:**
```
Authorization: Bearer <jwt-token>
```

**Token Payload:**
```json
{
  "id": "1",
  "username": "admin",
  "role": "admin",
  "iat": 1704902096,
  "exp": 1704988496
}
```

**Token Lifespan:** 24 hours (86400 seconds)

**Protected Endpoints:**
- `GET /config` - Requires JWT
- `PATCH /config` - Requires JWT
- `GET /config/exclude-tokens` - Requires JWT
- `POST /config/exclude-tokens` - Requires JWT
- `DELETE /config/exclude-tokens/:tokenAddress` - Requires JWT
- `POST /api/auth/logout` - Requires JWT
- `GET /api/auth/me` - Requires JWT
- `GET /dev/*` - Requires JWT (when enabled)

**Public Endpoints:**
- `POST /api/auth/login` - Public
- `GET /health` - Public
- `GET /stream/*` - Public (SSE streams)
- `POST /helius` - Protected by webhook secret

### Webhook Secret Authentication

The `/helius` endpoint uses a different authentication mechanism:

**Supported Header Formats:**
1. `x-helius-secret: <secret>` (Recommended)
2. `Authorization: <secret>`
3. `Authorization: Bearer <secret>`
4. `Authorization: X-Helius-Secret: <secret>` (legacy tolerance)

**Configuration:**
- Set via `WEBHOOK_SECRET` environment variable
- Must match the secret configured in Helius webhook dashboard
- Keep this secret separate from JWT_SECRET

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string with pooling support
- `DIRECT_URL` - Direct PostgreSQL connection (for migrations)
- `WEBHOOK_SECRET` - Helius webhook authentication secret

**Authentication:**
- `JWT_SECRET` - JWT signing secret (default: insecure development key)
- `ADMIN_USERNAME` - Admin username (default: "admin")
- `ADMIN_PASSWORD` - Admin password (default: "changeme")

**Server Configuration:**
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production/test)
- `ALLOWED_ORIGINS` - CORS allowed origins (default: all, use comma-separated list)
- `ALLOW_DEV_ENDPOINTS` - Enable development endpoints ("1" or "true")

**App Configuration (Runtime adjustable via API):**
- `EXCLUDE_TOKENS` - Comma-separated token addresses (default: WSOL mint)
- `MIN_AMOUNT` - Minimum transfer amount (default: 1)
- `DEDUP_BY_SIGNATURE_ONLY` - Dedup strategy ("1" or "true", default: false)
- `COORDINATED_WINDOW_MINUTES` - Detection window (default: 5)
- `COORDINATED_MIN_WALLETS` - Min wallets for alert (default: 5)
- `DEBUG_EVENTS` - Enable event logging ("1" or "true")
- `DEBUG_EVENTS_VERBOSE` - Verbose logging ("1" or "true")

**Wallet Sync:**
- `WALLETS_API_ENDPOINT` - Optional external API endpoint for wallet synchronization

### CORS Configuration

**Supported Methods:**
```
GET, POST, PATCH, PUT, DELETE, OPTIONS
```

**Allowed Headers:**
```
Content-Type, Authorization, x-helius-secret, Cache-Control
```

**Credentials:** Enabled (cookies/auth headers allowed)

**Origin Configuration:**
- `ALLOWED_ORIGINS=*` - Allow all origins (development only)
- `ALLOWED_ORIGINS=https://app.example.com,https://dashboard.example.com` - Specific origins
- Not set - Allows all origins by default

### Rate Limiting

**Current Status:** No rate limiting implemented

**Recommendations:**
- Implement client-side throttling for SSE events
- Consider debouncing rapid configuration updates
- Monitor webhook payload sizes (10MB limit configured)

### Error Handling Middleware

**Error Response Format:**
```json
{
  "error": "Error message",
  "stack": "... (only in development)"
}
```

**Special Cases:**
- Invalid JSON: 400 Bad Request - "Invalid JSON payload"
- Request aborted: 400 Bad Request - "Request aborted"
- Endpoint not found: 404 with path information
- Uncaught errors: 500 Internal Server Error

**404 Not Found Response:**
```json
{
  "error": "Endpoint not found",
  "path": "/invalid/endpoint"
}
```

---

## Support

For questions or issues with the API, contact the backend development team or refer to the main project README.
