# Wallet Sync System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Application Server                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     app.ts (Main)                          │ │
│  │                                                            │ │
│  │  1. Initialize services                                   │ │
│  │  2. Start WalletSyncService                              │ │
│  │  3. Register shutdown handlers                           │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│                         │ starts                                 │
│                         ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              WalletSyncService                             │ │
│  │                                                            │ │
│  │  • Performs initial sync (optional)                       │ │
│  │  • Calculates time until midnight                         │ │
│  │  • Schedules next sync                                    │ │
│  │  • Handles errors gracefully                              │ │
│  └──────┬──────────────────────────────────────┬──────────────┘ │
│         │                                       │                │
└─────────┼───────────────────────────────────────┼────────────────┘
          │                                       │
          │ fetches                               │ writes
          │                                       │
          ▼                                       ▼
┌──────────────────────┐            ┌──────────────────────┐
│   External API       │            │   wallets.json       │
│                      │            │                      │
│  GET /top-wallets    │            │  [                   │
│                      │            │    "wallet1...",     │
│  Returns:            │            │    "wallet2...",     │
│  [                   │            │    ...               │
│    {                 │            │  ]                   │
│      wallet_address, │            │                      │
│      token_address,  │            │  (100 addresses)     │
│      gross_profit,   │            └──────────────────────┘
│      ...             │
│    },                │
│    ...               │
│  ]                   │
└──────────────────────┘
```

## Scheduling Flow

```
Server Startup
      │
      ├─► Initialize WalletSyncService
      │
      ├─► Perform Initial Sync (optional)
      │   │
      │   ├─► Fetch from API
      │   ├─► Extract wallet_address
      │   ├─► Take first 100
      │   └─► Write to wallets.json
      │
      └─► Schedule Next Sync
          │
          ├─► Calculate milliseconds until midnight
          │   (tomorrow at 00:00:00)
          │
          └─► setTimeout(syncWallets, msUntilMidnight)
              │
              └─► At Midnight (00:00:00)
                  │
                  ├─► Execute Sync
                  │   │
                  │   ├─► Fetch from API
                  │   ├─► Extract addresses
                  │   ├─► Update wallets.json
                  │   └─► Log results
                  │
                  └─► Schedule Next Sync (24h later)
                      │
                      └─► Repeat daily...
```

## Data Flow

```
API Response                      Extraction                    Output
─────────────                    ──────────                    ──────

[                                                              [
  {                              wallet_address                  "Ez2jp3r...",
    "wallet_address": "Ez2...", ────────────────────►
    "token_address": "...",                                      "DshPqYh...",
    "gross_profit": 272364,     wallet_address
    ...                         ────────────────────►
  },                                                             "A8P6ePr...",
  {                             wallet_address
    "wallet_address": "Dsh...", ────────────────────►           ...
    "token_address": "...",
    ...                                                          (100 total)
  },
  ...                           First 100 only                 ]
  (100+ objects)                ────────────────────►
]
```

## Error Handling Flow

```
syncWallets()
    │
    ├─► Check if WALLETS_API_ENDPOINT is set
    │   │
    │   ├─► No  ──► Log warning, skip sync
    │   └─► Yes ──► Continue
    │
    ├─► fetchTopWallets()
    │   │
    │   ├─► API Request
    │   │   │
    │   │   ├─► Success ──► Return wallet addresses
    │   │   │
    │   │   └─► Error
    │   │       │
    │   │       ├─► Network error
    │   │       ├─► Timeout (30s)
    │   │       ├─► Invalid response
    │   │       └─► Log error, throw exception
    │   │
    │   └─► Validate response structure
    │       │
    │       ├─► Valid ──► Extract addresses
    │       └─► Invalid ──► Log error, throw
    │
    ├─► updateWalletsFile()
    │   │
    │   ├─► Write to file
    │   │   │
    │   │   ├─► Success ──► Log success
    │   │   └─► Error ──► Log error, throw
    │   │
    │   └─► Return
    │
    └─► Catch all errors
        │
        └─► Log error (service continues running)
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────┐
│                         Express App                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │  Webhook    │  │  Coordinator │  │  WalletSync     │    │
│  │  Service    │  │  Scanner     │  │  Service        │    │
│  └─────────────┘  └──────────────┘  └────────┬────────┘    │
│                                                │              │
│                                                │              │
└────────────────────────────────────────────────┼──────────────┘
                                                 │
                                                 │
                    ┌────────────────────────────┼────────────┐
                    │                            │            │
                    ▼                            ▼            ▼
            ┌──────────────┐           ┌──────────────┐  ┌──────────┐
            │   Database   │           │ wallets.json │  │   Logs   │
            │   (SQLite)   │           └──────────────┘  └──────────┘
            └──────────────┘
```

## Time-based Scheduling

```
Timeline (24-hour cycle)
─────────────────────────────────────────────────────────►

00:00 ─┬─► Sync executes
       │   - Fetch from API
       │   - Update wallets.json
       │   - Schedule next sync
       │
       └─► Calculate time until next 00:00
           (23:59:59.999)
           
           Server continues normal operation...
           
           ▼
23:59 ─────┐
           │
00:00 ◄────┘ Next sync executes
           │
           └─► Repeat cycle
```

## Manual vs Automatic Sync

```
┌─────────────────────────────────────────────────────────┐
│                    Automatic Sync                        │
│  (Built into server, runs at midnight)                  │
│                                                           │
│  app.ts → WalletSyncService.start(true)                 │
│            ├─► Initial sync on startup                   │
│            └─► Schedule daily at 00:00                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     Manual Sync                          │
│  (Run on demand via script)                             │
│                                                           │
│  npm run wallets:sync                                    │
│            │                                              │
│            └─► scripts/syncWallets.ts                    │
│                 └─► WalletSyncService.syncWallets()     │
│                     └─► One-time sync, then exit         │
└─────────────────────────────────────────────────────────┘
```

## Service States

```
┌─────────────┐
│   STOPPED   │ Initial state
└──────┬──────┘
       │ .start()
       ▼
┌─────────────┐
│  STARTING   │ Initializing
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   RUNNING   │ Active, scheduled sync pending
└──────┬──────┘
       │ .stop() or SIGTERM/SIGINT
       ▼
┌─────────────┐
│  STOPPING   │ Cleaning up
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   STOPPED   │ Shutdown complete
└─────────────┘
```

## File Structure

```
helius-wallet-tracker/
│
├── src/
│   ├── app.ts ──────────────────► Integrates WalletSyncService
│   │
│   ├── services/
│   │   ├── walletSync.ts ───────► Main service implementation
│   │   ├── coordinator.ts
│   │   └── webhook.ts
│   │
│   ├── lib/
│   │   └── env.ts ──────────────► Added WALLETS_API_ENDPOINT
│   │
│   └── wallets.json ────────────► Output file (updated daily)
│
├── scripts/
│   └── syncWallets.ts ──────────► Manual sync script
│
├── docs/
│   ├── WALLET_SYNC.md ──────────► Full documentation
│   ├── WALLET_SYNC_SETUP.md ────► Quick setup guide
│   ├── WALLET_SYNC_SUMMARY.md ──► Implementation summary
│   └── WALLET_SYNC_DIAGRAM.md ──► This file
│
└── .env.example ────────────────► Configuration template
```

## Configuration Variables

```
Environment Variables
│
├── WALLETS_API_ENDPOINT
│   └─► URL of the API endpoint
│       Example: "https://api.example.com/top-wallets"
│       Required: No (service skips if not set)
│       Default: undefined
│
└── (Other existing variables)
    ├─► PORT
    ├─► DATABASE_URL
    ├─► WEBHOOK_SECRET
    └─► ...
```

## Logging Events

```
Event Timeline
│
├── [INFO] Starting wallet sync service...
│   └─► Service initialization
│
├── [INFO] Fetching top 100 wallets from API...
│   └─► API request started
│
├── [INFO] Successfully fetched 100 wallet addresses
│   └─► API response received and validated
│
├── [INFO] Successfully updated wallets.json with 100 addresses
│   └─► File write completed
│
├── [INFO] Next wallet sync scheduled in 23h 45m (at midnight)
│   └─► Next sync scheduled
│
└── [ERROR] Failed to fetch wallets from API (if error occurs)
    └─► Error details and recovery
```

## Security Model

```
┌───────────────────────────────────────────────────┐
│              Security Boundaries                   │
├───────────────────────────────────────────────────┤
│                                                    │
│  Environment Variables (.env)                     │
│  ├─► WALLETS_API_ENDPOINT                        │
│  └─► Not exposed to clients                      │
│                                                    │
│  API Communication                                │
│  ├─► HTTPS recommended                            │
│  ├─► 30-second timeout                           │
│  └─► Error handling prevents crashes             │
│                                                    │
│  File System                                      │
│  ├─► Write-only to wallets.json                  │
│  ├─► Validates data before writing               │
│  └─► Proper error handling                       │
│                                                    │
│  Service Isolation                                │
│  ├─► Independent from other services             │
│  ├─► Errors don't crash app                      │
│  └─► Graceful degradation                        │
│                                                    │
└───────────────────────────────────────────────────┘
```
