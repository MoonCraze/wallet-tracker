# Helius Whale Wallet Tracker

Track Solana wallets via Helius Enhanced Webhooks and store results in SQLite using Prisma. Tuned for whale tracking: excludes common tokens (SOL by default) and small transfers (< 1 by default). Fully configurable via .env.

## Features
- Enhanced webhook parser (tokenTransfers, nativeTransfers, accountData)
- Idempotent persistence with compound unique key
- In-memory dedup per event and upsert in a single transaction
- Configurable filters: EXCLUDE_TOKENS and MIN_AMOUNT
- Optional coarse dedup by signature only
- NDJSON logging for offline replay and debugging

## Setup
1) Install deps
```powershell
npm i
```

2) Configure environment
```powershell
Copy-Item .env.example .env
# Fill HELIUS_API_KEY, WEBHOOK_URL, and adjust filters if needed
```

Important .env keys:
- HELIUS_API_KEY: your Helius API key (webhook:update script)
- WEBHOOK_URL: public https URL to your /helius endpoint (e.g., Cloudflared)
- WEBHOOK_SECRET: shared secret; verification accepts X-Helius-Secret or Authorization: Bearer <secret>
- DATABASE_URL: SQLite file (default prisma/dev.db)
- EXCLUDE_TOKENS: comma-separated mints to ignore (default: WSOL mint for SOL)
  - To track SOL, set EXCLUDE_TOKENS=""
- MIN_AMOUNT: minimum abs amount to save (default: 1)
- DEDUP_BY_SIGNATURE_ONLY: 1 to dedup by signature alone (optional, default 0)
- DEBUG_EVENTS / DEBUG_EVENTS_VERBOSE: set to 1 for more logs

3) Initialize DB
```powershell
npm run db:generate; npm run db:migrate
```

4) Start the server
```powershell
npm run dev
# or build and run
npm run build; node dist/index.js
```

5) Expose your local server (optional via Cloudflared)
```powershell
# Install once: winget install Cloudflare.cloudflared
cloudflared tunnel login
cloudflared tunnel run helius-tracker
```

6) Register/update the Helius webhook
```powershell
npm run webhook:update
```

7) Inspect DB
```powershell
npm run db:studio
```

## Scripts
- npm run dev: start server with tsx watch
- npm run build: compile TypeScript
- npm run start: run compiled server
- npm run db:generate / db:migrate / db:studio: Prisma workflow
- npm run webhook:update: create/update Helius enhanced webhook (uses wallets.json)
- npm run replay: reprocess logs/events.ndjson using the same parser and filters

## Filters and dedup behavior
- Default excludes SOL (WSOL mint), so only SPL tokens are saved unless you override EXCLUDE_TOKENS
- Default MIN_AMOUNT=1 skips dust; set to higher values for whales
- Dedup within each payload by (walletAddress, tokenAddress, signature). Enable DEDUP_BY_SIGNATURE_ONLY=1 to dedup more aggressively by signature

## Troubleshooting
- Set DEBUG_EVENTS=1 to see webhook summaries and parsed samples; set DEBUG_EVENTS_VERBOSE=1 to see skip/filter details
- If Helius sends duplicates or retries, upserts ensure idempotency
- With DEBUG_EVENTS=1, incoming events are logged to logs/events.ndjson for offline replay

cloudflared tunnel --config cloudflared-config.yml run

# Check everything is running
.\tunnel.ps1 status

# Start the tunnel (if stopped)
.\tunnel.ps1 start

# View application logs
docker-compose --env-file .env.production logs -f

 docker-compose down; docker-compose up --build -d 