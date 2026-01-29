# Database Comparison for Helius Wallet Tracker

## Current: SQLite
**Pros:**
- ✅ Zero configuration, file-based
- ✅ Perfect for development
- ✅ Low resource usage
- ✅ Built-in with Prisma

**Cons:**
- ❌ Limited concurrent writes
- ❌ No built-in time-series optimization
- ❌ Not ideal for production at scale
- ❌ Single file can become bottleneck

## Recommended: PostgreSQL + TimescaleDB

### Why PostgreSQL with TimescaleDB is BEST for your use case:

#### 1. **Time-Series Optimized** ⭐⭐⭐⭐⭐
- Your data is fundamentally time-series (transfers with timestamps)
- TimescaleDB provides automatic partitioning by time
- Faster queries on time ranges (critical for your coordinated trade detection)
- Automatic data retention policies
- Continuous aggregates for analytics

#### 2. **Performance**
- Handles millions of rows efficiently
- Optimized for INSERT-heavy workloads (your webhook events)
- Fast time-based queries (windowed aggregations)
- Better concurrent write performance than SQLite

#### 3. **Production Ready**
- Industry standard, battle-tested
- Excellent tooling and monitoring
- ACID compliance
- Proper indexing support

#### 4. **Scalability**
- Horizontal scaling with read replicas
- Sharding support if needed
- Connection pooling
- Can handle growth to millions of events

#### 5. **Analytics & Reporting**
- Built-in aggregation functions
- Window functions for time-series analysis
- Better support for complex queries
- JSON/JSONB support for flexible data

### Migration Complexity: 🟢 Low
Prisma makes it very easy to switch databases - just change the connection string!

### Setup Example:

**1. Update `schema.prisma`:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**2. Install TimescaleDB extension:**
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

**3. Convert to hypertable (after migration):**
```sql
SELECT create_hypertable('TransferEvent', 'timestamp');
SELECT create_hypertable('CoordinatedTrade', 'triggeredAt');
```

**4. Add useful indexes:**
```sql
CREATE INDEX idx_transfer_time_token ON "TransferEvent" (timestamp DESC, "tokenAddress");
CREATE INDEX idx_transfer_time_wallet ON "TransferEvent" (timestamp DESC, "walletAddress");
```

**5. Set up continuous aggregates for analytics:**
```sql
CREATE MATERIALIZED VIEW transfer_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS bucket,
  "tokenAddress",
  side,
  COUNT(*) as count,
  SUM(CAST(amount AS NUMERIC)) as total_amount
FROM "TransferEvent"
GROUP BY bucket, "tokenAddress", side;
```

---

## Other Options Comparison:

### MySQL
**Rating:** ⭐⭐⭐ (Good but not optimal)
- ✅ Production-ready
- ✅ Wide adoption
- ✅ Good performance
- ❌ No native time-series optimization
- ❌ Less advanced features than PostgreSQL
- ❌ Not ideal for analytical queries

### DuckDB
**Rating:** ⭐⭐ (Not recommended for this use case)
- ✅ Excellent for analytics
- ✅ Fast analytical queries
- ✅ Embedded like SQLite
- ❌ **NOT designed for concurrent writes** (deal breaker!)
- ❌ Better for read-heavy analytical workloads, not webhook ingestion
- ❌ Would struggle with real-time inserts from webhooks
- ❌ Primarily OLAP, not OLTP

**DuckDB is WRONG for your use case** because:
- You have high-frequency webhook writes
- Need concurrent access
- Real-time data ingestion
- DuckDB excels at batch analytics, not live transactional workloads

---

## 🏆 Final Recommendation

**Use PostgreSQL + TimescaleDB**

### Quick Migration Steps:

1. **Install PostgreSQL** (locally or use cloud service):
   - Local: Download from postgresql.org
   - Cloud: Neon, Supabase, Railway, or AWS RDS

2. **Install TimescaleDB**:
   ```bash
   # If using Docker
   docker run -d --name timescaledb -p 5432:5432 -e POSTGRES_PASSWORD=password timescale/timescaledb:latest-pg16
   ```

3. **Update environment variables**:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/helius_tracker?schema=public"
   ```

4. **Migrate schema**:
   ```bash
   npx prisma migrate dev --name switch_to_postgresql
   ```

5. **Enable TimescaleDB** (run SQL):
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   SELECT create_hypertable('TransferEvent', 'timestamp');
   SELECT create_hypertable('CoordinatedTrade', 'triggeredAt');
   ```

### Benefits You'll Get Immediately:
- ✅ 10-100x faster time-range queries
- ✅ Automatic data partitioning
- ✅ Better production scalability
- ✅ Advanced analytics capabilities
- ✅ Data retention policies
- ✅ Continuous aggregates for dashboards

### Cloud Options (Managed PostgreSQL + TimescaleDB):
- **Timescale Cloud** - Native TimescaleDB hosting (recommended)
- **Neon** - Serverless PostgreSQL (can install TimescaleDB extension)
- **Supabase** - PostgreSQL with great tooling
- **Railway** - Simple deployment
- **AWS RDS** - Enterprise option

---

## Cost Comparison (for ~1M events/month):

| Database | Monthly Cost | Complexity |
|----------|-------------|------------|
| SQLite | $0 (file-based) | Low |
| PostgreSQL (self-hosted) | $5-20 (VPS) | Medium |
| TimescaleDB Cloud | $50-100 | Low |
| AWS RDS PostgreSQL | $25-100 | Medium |

**For your FYP project:** Start with free tier of Neon or Supabase, then move to Timescale Cloud if you need advanced features.
