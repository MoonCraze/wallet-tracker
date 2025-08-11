# Coordinated Trades API Documentation

## Overview
This API provides access to coordinated trading data detected by the Helius Wallet Tracker. The system identifies when multiple wallets purchase the same token within a specified time window, indicating potential coordinated trading activity.

## Base URL
- Development: `http://localhost:8080`
- Production: `[Your production URL]`

## CORS Configuration
The API supports Cross-Origin Resource Sharing (CORS) for access from different domains/locations.

### Environment Variables
Configure CORS by setting the `ALLOWED_ORIGINS` environment variable:

```bash
# Allow all origins (for development)
ALLOWED_ORIGINS=*

# Allow specific origins (for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,http://localhost:3000

# Enable development endpoints
ALLOW_DEV_ENDPOINTS=1
```

### Supported CORS Headers
- **Origin**: Configurable via `ALLOWED_ORIGINS`
- **Methods**: `GET, POST, PATCH, PUT, DELETE, OPTIONS`
- **Headers**: `Content-Type, Authorization, x-helius-secret`
- **Credentials**: Supported (`Access-Control-Allow-Credentials: true`)

## Authentication
- All endpoints are currently open (no authentication required)
- Enable development endpoints by setting `ALLOW_DEV_ENDPOINTS=1` in environment variables

---

## Endpoints

### 1. Get Coordinated Trades (REST API)

#### Endpoint
```
GET /dev/db/coordinated
```

#### Description
Retrieves paginated list of detected coordinated trades from the database.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number for pagination |
| `limit` | integer | `50` | Number of records per page (max: 200) |

#### Example Request
```bash
curl "http://localhost:8080/dev/db/coordinated?page=1&limit=10"
```

#### Response Structure
```typescript
{
  "coordinated": CoordinatedTrade[],
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "pages": number
  }
}
```

#### CoordinatedTrade Object
```typescript
{
  "id": string,                    // Unique identifier
  "tokenAddress": string,          // Token contract address
  "windowStart": string,           // ISO timestamp - start of detection window
  "windowEnd": string,             // ISO timestamp - end of detection window
  "triggeredAt": string,           // ISO timestamp - when coordination was detected
  "uniqueWalletCount": number,     // Number of unique wallets involved
  "walletAddresses": string        // JSON string array of wallet addresses
}
```

#### Example Response
```json
{
  "coordinated": [
    {
      "id": "clm123abc456def",
      "tokenAddress": "So11111111111111111111111111111111111111112",
      "windowStart": "2025-08-11T10:00:00.000Z",
      "windowEnd": "2025-08-11T10:05:00.000Z",
      "triggeredAt": "2025-08-11T10:03:45.123Z",
      "uniqueWalletCount": 7,
      "walletAddresses": "[\"wallet1...\", \"wallet2...\", \"wallet3...\"]"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  }
}
```

---

### 2. Real-time Coordinated Trades (Server-Sent Events)

#### Endpoint
```
GET /stream/coordinated
```

#### Description
Establishes a real-time connection to receive coordinated trade events as they are detected.

#### Connection Type
Server-Sent Events (SSE) - maintains a persistent HTTP connection

#### Event Data Structure
```typescript
{
  "tokenAddress": string,          // Token contract address
  "windowStart": string,           // ISO timestamp - start of detection window
  "windowEnd": string,             // ISO timestamp - end of detection window
  "triggeredAt": string,           // ISO timestamp - when coordination was detected
  "uniqueWalletCount": number,     // Number of unique wallets involved
  "walletAddresses": string[]      // Array of wallet addresses (parsed from JSON)
}
```

#### Implementation Example (JavaScript)
```javascript
// Establish SSE connection
const eventSource = new EventSource('http://localhost:8080/stream/coordinated');

eventSource.onmessage = function(event) {
  const coordinatedTrade = JSON.parse(event.data);
  console.log('New coordinated trade detected:', coordinatedTrade);
  
  // Handle the coordinated trade data
  handleCoordinatedTrade(coordinatedTrade);
};

eventSource.onerror = function(event) {
  console.error('SSE connection error:', event);
};

function handleCoordinatedTrade(trade) {
  // Your implementation here
  console.log(`Token ${trade.tokenAddress} bought by ${trade.uniqueWalletCount} wallets`);
  console.log('Involved wallets:', trade.walletAddresses);
}
```

---

### 3. Combined Real-time Stream

#### Endpoint
```
GET /stream/all
```

#### Description
Receives both transfer events and coordinated trades in a single stream with named events.

#### Event Types
- `coordinated` - Coordinated trade detection
- `transfers` - Individual transfer events

#### Implementation Example (JavaScript)
```javascript
const eventSource = new EventSource('http://localhost:8080/stream/all');

eventSource.addEventListener('coordinated', function(event) {
  const coordinatedTrade = JSON.parse(event.data);
  console.log('Coordinated trade:', coordinatedTrade);
});

eventSource.addEventListener('transfers', function(event) {
  const transfers = JSON.parse(event.data);
  console.log('Transfer events:', transfers);
});
```

---

## Configuration Endpoints

### Get Current Configuration
```
GET /config
```

Returns current system configuration including coordination detection parameters.

### Update Configuration
```
PATCH /config
Content-Type: application/json

{
  "coordinatedWindowMinutes": 5,
  "coordinatedMinWallets": 5,
  "minAmount": 1
}
```

#### Configuration Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coordinatedWindowMinutes` | integer | `5` | Time window in minutes for detecting coordination |
| `coordinatedMinWallets` | integer | `5` | Minimum number of wallets required to trigger coordination alert |
| `minAmount` | number | `1` | Minimum transaction amount to consider |
| `excludeTokens` | string[] | `[WSOL_MINT]` | Token addresses to exclude from tracking |

---

## Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (if authentication is enabled)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": "Error description"
}
```

---

## Implementation Guide

### Frontend Integration Steps

1. **Fetch Historical Data**
   ```javascript
   async function fetchCoordinatedTrades(page = 1, limit = 50) {
     const response = await fetch(`/dev/db/coordinated?page=${page}&limit=${limit}`);
     const data = await response.json();
     return data;
   }
   ```

2. **Setup Real-time Updates**
   ```javascript
   function setupRealtimeUpdates() {
     const eventSource = new EventSource('/stream/coordinated');
     
     eventSource.onmessage = (event) => {
       const trade = JSON.parse(event.data);
       addCoordinatedTradeToUI(trade);
     };
     
     return eventSource;
   }
   ```

3. **Parse Wallet Addresses**
   ```javascript
   function parseWalletAddresses(coordinatedTrade) {
     // For REST API responses, parse the JSON string
     const wallets = JSON.parse(coordinatedTrade.walletAddresses);
     
     // For SSE responses, walletAddresses is already an array
     return Array.isArray(coordinatedTrade.walletAddresses) 
       ? coordinatedTrade.walletAddresses 
       : JSON.parse(coordinatedTrade.walletAddresses);
   }
   ```

### React Example Component
```jsx
import React, { useState, useEffect } from 'react';

function CoordinatedTrades() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial data
    fetchCoordinatedTrades().then(data => {
      setTrades(data.coordinated);
      setLoading(false);
    });

    // Setup real-time updates
    const eventSource = new EventSource('/stream/coordinated');
    eventSource.onmessage = (event) => {
      const newTrade = JSON.parse(event.data);
      setTrades(prev => [newTrade, ...prev]);
    };

    return () => eventSource.close();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Coordinated Trades</h2>
      {trades.map(trade => (
        <div key={trade.id || `${trade.tokenAddress}-${trade.windowStart}`}>
          <p>Token: {trade.tokenAddress}</p>
          <p>Wallets: {trade.uniqueWalletCount}</p>
          <p>Time: {new Date(trade.triggeredAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Rate Limiting & Best Practices

1. **Pagination**: Use appropriate page sizes (recommended: 10-50 records)
2. **Connection Management**: Properly close SSE connections when components unmount
3. **Error Handling**: Implement reconnection logic for SSE connections
4. **Data Deduplication**: The system handles deduplication, but implement client-side checks for UI consistency

---

## Environment Variables

To enable development endpoints, set:
```bash
ALLOW_DEV_ENDPOINTS=1
```

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Wallet addresses in coordinated trades are sorted alphabetically
- The system uses a rolling time window for detection
- Coordinated trades are detected in real-time as transactions occur
- The database stores all historical coordinated trade events

---

## Accessing from Different Locations/PCs

### For Development
1. **Enable CORS for all origins**:
   ```bash
   ALLOWED_ORIGINS=*
   ALLOW_DEV_ENDPOINTS=1
   ```

2. **Update the base URL in your frontend**:
   ```javascript
   // Replace localhost with your server's IP address or domain
   const client = new CoordinatedTradesClient('http://192.168.1.100:8080');
   // or
   const client = new CoordinatedTradesClient('https://your-domain.com');
   ```

### For Production
1. **Configure specific allowed origins**:
   ```bash
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. **Use HTTPS for security**:
   - Set up SSL/TLS certificates
   - Use reverse proxy (nginx, cloudflare, etc.)
   
3. **Example production configuration**:
   ```bash
   NODE_ENV=production
   ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
   ALLOW_DEV_ENDPOINTS=0  # Disable dev endpoints in production
   ```

### Network Access Examples

#### Local Network Access
```javascript
// If your server is at IP 192.168.1.100
const client = new CoordinatedTradesClient('http://192.168.1.100:8080');
```

#### Remote Access via Tunnel (Cloudflare, ngrok)
```javascript
// Using Cloudflare tunnel
const client = new CoordinatedTradesClient('https://your-tunnel-domain.trycloudflare.com');

// Using ngrok
const client = new CoordinatedTradesClient('https://abc123.ngrok.io');
```

#### Production Domain
```javascript
// Production domain with SSL
const client = new CoordinatedTradesClient('https://api.yourdomain.com');
```
