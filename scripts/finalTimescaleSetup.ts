import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

/**
 * Enable TimescaleDB and convert tables to hypertables
 * 
 * This script:
 * 1. Updates primary keys to include time columns (required for TimescaleDB)
 * 2. Enables TimescaleDB extension
 * 3. Converts tables to hypertables for time-series optimization
 * 
 * Run only once during initial setup or after fresh migration
 */
async function enableTimescaleDB() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('🔧 Configuring TimescaleDB for time-series optimization...\n');
    
    // Step 1: Remove duplicate unique indexes
    console.log('1. Removing duplicate indexes...');
    await client.query('DROP INDEX IF EXISTS wallet_token_sig_time_unique');
    console.log('✅ Removed duplicate\n');
    
    // Step 2: Drop and recreate primary key to include timestamp
    console.log('2. Updating primary key to include timestamp...');
    await client.query('ALTER TABLE "TransferEvent" DROP CONSTRAINT "TransferEvent_pkey"');
    await client.query('ALTER TABLE "TransferEvent" ADD PRIMARY KEY (id, timestamp)');
    console.log('✅ Primary key updated\n');
    
    // Step 3: Same for CoordinatedTrade
    console.log('3. Updating CoordinatedTrade primary key...');
    await client.query('ALTER TABLE "CoordinatedTrade" DROP CONSTRAINT "CoordinatedTrade_pkey"');
    await client.query('ALTER TABLE "CoordinatedTrade" ADD PRIMARY KEY (id, "triggeredAt")');
    console.log('✅ CoordinatedTrade updated\n');
    
    // Step 4: Enable TimescaleDB
    console.log('4. Enabling TimescaleDB extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');
    console.log('✅ Enabled\n');
    
    // Step 5: Create hypertables
    console.log('5. Converting to hypertables...');
    await client.query(`SELECT create_hypertable('"TransferEvent"', 'timestamp', if_not_exists => TRUE)`);
    console.log('✅ TransferEvent is a hypertable');
    
    await client.query(`SELECT create_hypertable('"CoordinatedTrade"', 'triggeredAt', if_not_exists => TRUE)`);
    console.log('✅ CoordinatedTrade is a hypertable\n');
    
    // Step 6: Verify
    const result = await client.query('SELECT hypertable_name FROM timescaledb_information.hypertables');
    console.log('🎉 TimescaleDB successfully enabled!\n');
    console.log('Active hypertables:');
    result.rows.forEach(r => console.log(`  ✅ ${r.hypertable_name}`));
    
    console.log('\n✨ Benefits:');
    console.log('  - Automatic time-based partitioning (chunks)');
    console.log('  - 10-100x faster time-range queries');
    console.log('  - Optimized for high-volume inserts');
    console.log('  - Perfect for analytics and aggregations\n');
    
    await client.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nIf tables already have data, this script may fail.');
    console.error('Run this on a fresh database after initial migration.\n');
    await client.end();
    process.exit(1);
  }
}

enableTimescaleDB();
