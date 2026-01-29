# Migration Guide: Supabase → Better Free PostgreSQL

## Issue with Supabase Free Tier
- IPv6-only connections
- IPv4 requires paid add-on ($4/month)
- Connection issues from many networks

## ✅ Recommended Solution: Neon.tech

### Why Neon is Perfect for Your FYP:
1. **Free forever** - 0.5GB storage, enough for millions of events
2. **IPv4 support** - Works from any network
3. **Serverless** - Auto-scales, auto-suspends (saves resources)
4. **PostgreSQL 16** - Latest version
5. **Fast setup** - 2 minutes to get connection string
6. **No credit card** required for free tier

### Setup Steps:

#### 1. Create Neon Account
```
1. Go to: https://neon.tech
2. Sign up with GitHub/Google (no credit card needed)
3. Create new project: "helius-wallet-tracker"
4. Select region: Choose closest to you
```

#### 2. Get Connection String
After project creation, you'll see:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

Example:
```
postgresql://neondb_owner:AbC123XyZ@ep-cool-breeze-12345678.us-east-2.aws.neon.tech/neondb?sslmode=require
```

#### 3. Update Your .env
Replace both lines:
```env
DATABASE_URL="[PASTE YOUR NEON CONNECTION STRING HERE]"
DIRECT_URL="[SAME CONNECTION STRING]"
```

#### 4. Run Migration
```bash
npx prisma generate
npx prisma migrate dev --name initial_migration
```

#### 5. Verify Connection
```bash
npx tsx scripts/testConnection.ts
```

---

## Alternative Options (if Neon doesn't work):

### Option 2: Railway.app
- Free tier: $5 credit/month
- PostgreSQL with IPv4
- Easy deployment
- Get connection string from dashboard

**Setup:**
1. Go to: https://railway.app
2. New Project → PostgreSQL
3. Copy PostgreSQL connection URL
4. Update .env DATABASE_URL

### Option 3: ElephantSQL
- Free tier: 20MB (very limited)
- Good for testing only
- IPv4 support

**Setup:**
1. Go to: https://www.elephantsql.com
2. Create free "Tiny Turtle" instance
3. Copy URL from details page
4. Update .env DATABASE_URL

### Option 4: Render.com
- Free tier PostgreSQL
- Auto-expires after 90 days of inactivity
- Full PostgreSQL features

**Setup:**
1. Go to: https://render.com
2. New → PostgreSQL
3. Choose Free tier
4. Copy External Database URL
5. Update .env DATABASE_URL

---

## Comparison Table

| Provider | Free Tier | Storage | IPv4 | Best For |
|----------|-----------|---------|------|----------|
| **Neon** ⭐ | Forever | 0.5GB | ✅ | Production FYP |
| Railway | $5/mo credit | Unlimited | ✅ | Easy deployment |
| Supabase | Forever | 500MB | ❌ (IPv6 only) | If you have IPv6 |
| ElephantSQL | Forever | 20MB | ✅ | Quick testing only |
| Render | Forever | 1GB | ✅ | Good alternative |

---

## After Migration Checklist

Once you have your new connection string:

```bash
# 1. Update .env with new DATABASE_URL
# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npx prisma migrate dev --name initial_migration

# 4. Test connection
npx tsx scripts/testConnection.ts

# 5. Start your server
npm run dev

# 6. Test endpoints
curl http://localhost:8080/dev/db/stats
```

---

## My Recommendation

**Use Neon.tech** - It's the best free option for your FYP project:
- Reliable and fast
- No connection issues
- Scales with your project
- No credit card required
- Can add TimescaleDB later if needed

**Total setup time: 5 minutes**
