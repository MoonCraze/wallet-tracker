# Helius 100-Wallet Realtime Tracker

Track ~100 Solana wallets with a Helius webhook. Saves events to SQLite via Prisma.

## 1) Install & configure
```bash
pnpm i   # or npm i / yarn
cp .env.example .env
# fill in HELIUS_API_KEY, WEBHOOK_URL (public https://your-domain.com/helius), WEBHOOK_SECRET

pnpm db:generate
pnpm db:migrate

pnpm dev
# or build+run
pnpm build && node dist/index.js

pnpm webhook:update

pnpm db:studio

Notes:
- Webhook verification accepts `x-helius-secret: <secret>` or `Authorization: Bearer <secret>`.
- On internal errors the webhook now returns HTTP 500 so Helius retries delivery.
- The webhook update script accepts either `HELIUS_API_KEY` or legacy `HELlUS_API_KEY`.

Troubleshooting:
- Set `DEBUG_EVENTS=1` when running the server to log why events were skipped (useful to confirm wallet address matches against `fromUserAccount`/`toUserAccount`).

winget install Cloudflare.cloudflared
cloudflared tunnel login

npm run webhook:update

npm run db:studio

Steps

# 1) Start the dev server
$env:PORT="8080"; $env:DEBUG_EVENTS="1"; npm run dev

# 2) Start the tunnel (assumes your tunnel maps to http://localhost:8080)
cloudflared tunnel run helius-tracker

# 3) (Re)register/update the Helius webhook
npm run webhook:update