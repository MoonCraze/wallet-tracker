import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

/**
 * Test PostgreSQL database connection
 * Verifies both DATABASE_URL and DIRECT_URL connections
 * Also checks TimescaleDB status if enabled
 */
async function testPostgresConnection() {
  console.log('Testing PostgreSQL connection...\n');
  
  const urls = [
    { name: 'Application (DATABASE_URL)', url: process.env.DATABASE_URL },
    { name: 'Direct (DIRECT_URL)', url: process.env.DIRECT_URL }
  ];
  
  for (const { name, url } of urls) {
    if (!url) {
      console.log(`⚠️  ${name} not configured\n`);
      continue;
    }
    
    console.log(`--- Testing ${name} ---`);
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+?)(?:\?|$)/);
    if (match) {
      console.log(`Host: ${match[3]}`);
      console.log(`Port: ${match[4] || '5432'}`);
      console.log(`Database: ${match[5].split('?')[0]}`);
      console.log(`User: ${match[1]}`);
    }
    
    const client = new Client({ connectionString: url, ssl: false });

    try {
      await client.connect();
      console.log('✅ Connection successful!\n');
      
      // Get PostgreSQL version
      const versionResult = await client.query('SELECT version()');
      const version = versionResult.rows[0].version;
      console.log('PostgreSQL:', version.substring(0, 60) + '...\n');
      
      // Check if TimescaleDB is enabled
      const tsdbResult = await client.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
      );
      
      if (tsdbResult.rows.length > 0) {
        console.log(`✅ TimescaleDB: v${tsdbResult.rows[0].extversion}`);
        
        // List hypertables
        const hypertables = await client.query(
          'SELECT hypertable_name FROM timescaledb_information.hypertables'
        );
        
        if (hypertables.rows.length > 0) {
          console.log('\nHypertables (time-series optimized):');
          hypertables.rows.forEach(row => console.log(`  ✅ ${row.hypertable_name}`));
        } else {
          console.log('  No hypertables configured yet');
        }
        console.log();
      } else {
        console.log('ℹ️  TimescaleDB extension not enabled\n');
      }
      
      // Test table access
      try {
        const tableCheck = await client.query(`
          SELECT COUNT(*) as transfer_count FROM "TransferEvent";
        `);
        const coordCheck = await client.query(`
          SELECT COUNT(*) as coordinated_count FROM "CoordinatedTrade";
        `);
        
        console.log('Database Status:');
        console.log(`  - TransferEvent records: ${tableCheck.rows[0].transfer_count}`);
        console.log(`  - CoordinatedTrade records: ${coordCheck.rows[0].coordinated_count}\n`);
      } catch (tableError: any) {
        console.log('⚠️  Tables not yet created. Run migrations first.\n');
      }
      
      await client.end();
      console.log('🎉 Database connection verified!\n');
      return true;
    } catch (error: any) {
      console.error('❌ Connection failed:', error.message);
      console.error('\nTroubleshooting:');
      console.error('1. Check DATABASE_URL in .env file');
      console.error('2. Verify database server is running');
      console.error('3. Ensure firewall allows connection\n');
    }
  }
  
  return false;
}

testPostgresConnection();
