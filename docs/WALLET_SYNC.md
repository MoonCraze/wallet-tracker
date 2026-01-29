# Wallet Sync Service

The Wallet Sync Service automatically fetches the top 100 performing wallet addresses from an API endpoint and updates the `src/wallets.json` file daily at midnight (00:00).

## Features

- **Automatic Daily Sync**: Fetches wallet data every day at 00:00
- **Initial Sync on Startup**: Optionally performs an immediate sync when the server starts
- **Top 100 Wallets**: Extracts only the first 100 wallet addresses from the API response
- **Error Handling**: Robust error handling with detailed logging
- **Graceful Shutdown**: Properly cleans up scheduled tasks on server shutdown

## Configuration

### Environment Variable

Add the following environment variable to your `.env` file:

```bash
WALLETS_API_ENDPOINT=https://your-api-endpoint.com/top-wallets
```

This endpoint should return a JSON array of wallet data objects with the following structure:

```json
[
  {
    "wallet_address": "Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN",
    "token_address": "aydmk6m64e2uwre9ked3m4spyg96vguespglwdleuthv",
    "gross_profit": 272364,
    "realized_profit": 65142,
    "realized_profit_percent": 7.19,
    "unrealized_profit": 66272,
    "unrealized_profit_percent": 7.31,
    "win_rate": 54.85,
    "wins": 198,
    "losses": 163,
    "trade_volume": 2000000,
    "trades": 2700,
    "avg_trade_size": 746,
    "is_bot": 0
  },
  ...
]
```

## Usage

### Automatic Sync

The wallet sync service starts automatically when your application server starts. It will:

1. Perform an initial sync immediately on startup (if configured)
2. Schedule the next sync at midnight (00:00:00)
3. Continue syncing daily at midnight

### Manual Sync

You can manually trigger a wallet sync at any time using the provided script:

```bash
npm run wallets:sync
```

Or directly with tsx:

```bash
tsx scripts/syncWallets.ts
```

### Output

The service updates the `src/wallets.json` file with an array of wallet addresses:

```json
[
  "Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN",
  "DshPqYhX7JJhWaSUY5R4mWw5JRZU6Lb2qZczFdTLGztM",
  "A8P6ePrf24aKF3Zj9KLfHofx6D4Jx4LxeNEgFboVWC6c",
  ...
]
```

## API Requirements

Your API endpoint must:

1. Return a JSON array of objects
2. Each object must have a `wallet_address` field (string)
3. Return at least 100 wallet records (service will take the first 100)
4. Be accessible via HTTP/HTTPS GET request
5. Respond within 30 seconds (default timeout)

## Logging

The service logs important events:

- **Info**: Sync start/completion, scheduling information
- **Warning**: Missing configuration, empty responses
- **Error**: API failures, file write errors, network issues

Example logs:

```
[INFO] Starting wallet sync service...
[INFO] Fetching top 100 wallets from API... endpoint=https://api.example.com/wallets
[INFO] Successfully fetched 100 wallet addresses
[INFO] Successfully updated wallets.json with 100 addresses
[INFO] Next wallet sync scheduled in 23h 45m (at midnight)
```

## Error Handling

The service handles various error scenarios:

- **Missing API Endpoint**: Logs a warning and skips sync
- **Network Errors**: Logs error details including status codes
- **Invalid Response**: Validates response structure
- **File Write Errors**: Logs file system errors
- **Timeout**: 30-second timeout for API requests

Errors during sync do not crash the application - they are logged and the service continues running.

## Service Control

### Start
The service starts automatically with the application server.

### Stop
The service stops gracefully when the application receives SIGINT or SIGTERM signals.

### Status
The service tracks its running state and can be queried programmatically.

## Implementation Details

### Files

- **Service**: `src/services/walletSync.ts` - Main wallet sync service
- **Script**: `scripts/syncWallets.ts` - Manual sync script
- **Output**: `src/wallets.json` - Wallet addresses storage
- **Config**: `.env` - Environment configuration

### Architecture

The `WalletSyncService` class provides:

- `start()`: Initialize and schedule daily syncs
- `stop()`: Clean up and stop the service
- `syncWallets()`: Perform a single sync operation
- `fetchTopWallets()`: Fetch data from API
- `updateWalletsFile()`: Write to wallets.json
- `getStatus()`: Get current service status

### Scheduling

The service uses `setTimeout` to schedule syncs at midnight:

1. Calculates milliseconds until next midnight
2. Sets a timeout for that duration
3. Executes sync at midnight
4. Reschedules for the next midnight

This approach ensures syncs happen at exactly 00:00:00 local time.

## Testing

### Test Manual Sync

```bash
# Set the API endpoint
export WALLETS_API_ENDPOINT=https://your-api-endpoint.com/top-wallets

# Run manual sync
npm run wallets:sync
```

### Test with Mock Data

You can test with a local JSON file or mock API endpoint:

```bash
# Use json-server or similar to serve mock data
npx json-server --watch mock-wallets.json --port 3001

# Set endpoint to local server
export WALLETS_API_ENDPOINT=http://localhost:3001/wallets

# Run sync
npm run wallets:sync
```

## Troubleshooting

### Sync Not Running

1. Check if `WALLETS_API_ENDPOINT` is set in `.env`
2. Verify the API endpoint is accessible
3. Check application logs for errors

### Invalid Data

1. Verify API response structure matches expected format
2. Check that `wallet_address` field exists in response objects
3. Ensure response is a valid JSON array

### File Not Updated

1. Check file system permissions for `src/wallets.json`
2. Verify the path is correct
3. Check logs for write errors

### Scheduling Issues

1. Verify server timezone is correct
2. Check system clock
3. Review scheduling logs for next sync time

## Security Considerations

- Store API endpoint in environment variables, not in code
- Use HTTPS endpoints when possible
- Implement API authentication if required (extend service)
- Validate API responses before writing to file
- Handle sensitive data appropriately

## Future Enhancements

Potential improvements:

- Add authentication support for API endpoints
- Implement backup/restore of previous wallet lists
- Add webhook notifications on sync completion
- Support for multiple API endpoints with fallback
- Configurable sync schedule (not just midnight)
- Metrics and monitoring integration
- Rate limiting for API requests
