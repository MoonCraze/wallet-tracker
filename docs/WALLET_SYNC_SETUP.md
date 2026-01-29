# Quick Setup Guide - Wallet Sync

Follow these steps to set up the automatic wallet sync feature:

## Step 1: Configure API Endpoint

Add the following to your `.env` file (create one from `.env.example` if you don't have it):

```bash
WALLETS_API_ENDPOINT=https://your-api-endpoint.com/top-wallets
```

Replace `https://your-api-endpoint.com/top-wallets` with your actual API endpoint.

## Step 2: Verify API Response Format

Make sure your API endpoint returns data in this format:

```json
[
  {
    "wallet_address": "Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN",
    "token_address": "...",
    "gross_profit": 272364,
    "realized_profit": 65142,
    ...
  },
  ...
]
```

The service will extract only the `wallet_address` field.

## Step 3: Test Manual Sync (Optional but Recommended)

Before starting the server, test the sync manually:

```bash
npm run wallets:sync
```

This will:
- Fetch data from your API endpoint
- Update `src/wallets.json` with the first 100 wallet addresses
- Show any errors if something is wrong

## Step 4: Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The wallet sync service will:
- ✅ Run an initial sync immediately
- ✅ Schedule the next sync at midnight (00:00)
- ✅ Continue syncing daily

## Step 5: Verify It's Working

Check the logs for messages like:

```
[INFO] Starting wallet sync service...
[INFO] Fetching top 100 wallets from API...
[INFO] Successfully fetched 100 wallet addresses
[INFO] Successfully updated wallets.json with 100 addresses
[INFO] Next wallet sync scheduled in 23h 45m (at midnight)
```

## Troubleshooting

### "No WALLETS_API_ENDPOINT configured"
- Add `WALLETS_API_ENDPOINT` to your `.env` file
- Make sure it starts with `http://` or `https://`

### "Failed to fetch wallets from API"
- Check if the API endpoint is accessible
- Verify the URL is correct
- Check if the API requires authentication (you may need to extend the service)

### "No valid wallet addresses found"
- Verify API response structure matches expected format
- Check that `wallet_address` field exists in response objects
- Make sure API returns at least one record

### File not updated
- Check file permissions for `src/wallets.json`
- Look for write errors in the logs

## What Happens Next?

Once running:

1. **Initial Sync**: Happens immediately when server starts
2. **Daily Sync**: Runs automatically every day at 00:00
3. **Manual Sync**: You can run `npm run wallets:sync` anytime

The `src/wallets.json` file will always contain the latest top 100 wallet addresses.

## Example API Response

Your endpoint should return something like:

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
  ... (more wallet objects)
]
```

And `wallets.json` will contain:

```json
[
  "Ez2jp3rwXUbaTx7XwiHGaWVgTPFdzJoSg8TopqbxfaJN",
  "DshPqYhX7JJhWaSUY5R4mWw5JRZU6Lb2qZczFdTLGztM",
  "A8P6ePrf24aKF3Zj9KLfHofx6D4Jx4LxeNEgFboVWC6c",
  ... (98 more addresses)
]
```

## Need Help?

See the full documentation:
- [WALLET_SYNC.md](WALLET_SYNC.md) - Complete documentation
- [WALLET_SYNC_SUMMARY.md](WALLET_SYNC_SUMMARY.md) - Implementation summary

Or check the code:
- Service: `src/services/walletSync.ts`
- Manual script: `scripts/syncWallets.ts`
