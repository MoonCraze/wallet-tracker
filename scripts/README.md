# Database Scripts

This directory contains utility scripts for database management and setup.

## Available Scripts

### `testConnection.ts`
Test PostgreSQL database connectivity and verify TimescaleDB status.

```bash
npm run db:test
# or
npx tsx scripts/testConnection.ts
```

**What it checks:**
- Database connection (both DATABASE_URL and DIRECT_URL)
- PostgreSQL version
- TimescaleDB extension status
- Hypertables configuration
- Table record counts

---

### `finalTimescaleSetup.ts`
Enable TimescaleDB extension and convert tables to hypertables for time-series optimization.

```bash
npm run db:setup-timescale
# or
npx tsx scripts/finalTimescaleSetup.ts
```

**What it does:**
- Updates primary keys to include time columns (required for TimescaleDB)
- Enables TimescaleDB extension
- Converts `TransferEvent` and `CoordinatedTrade` to hypertables
- Sets up automatic time-based partitioning

**⚠️ Important:**
- Run only ONCE after initial migration
- Must be run on a fresh database (no existing data)
- Cannot be undone easily

---

### `syncWallets.ts`
Sync wallet addresses from external API or database.

```bash
npm run wallets:sync
# or
npx tsx scripts/syncWallets.ts
```

---

### `updateWebhook.ts`
Update Helius webhook configuration.

```bash
npm run webhook:update
# or
npx tsx scripts/updateWebhook.ts
```

---

## Typical Setup Workflow

```bash
# 1. Test database connection
npm run db:test

# 2. Generate Prisma client
npm run db:generate

# 3. Run migrations
npm run db:migrate

# 4. Enable TimescaleDB (optional, one-time)
npm run db:setup-timescale

# 5. Verify setup
npm run db:test

# 6. Start application
npm run dev
```

---

## Notes

- All scripts use environment variables from `.env`
- TypeScript files are executed with `tsx` (TypeScript executor)
- Refer to main documentation in `/docs` for detailed setup guides
