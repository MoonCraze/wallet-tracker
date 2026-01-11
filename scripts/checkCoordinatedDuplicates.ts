import { prisma } from '../src/db';

async function checkDuplicates() {
  console.log('Checking for duplicate coordinated trades...\n');
  
  // Find duplicates by token + windowStart
  const duplicates = await prisma.$queryRaw<Array<{
    tokenAddress: string;
    windowStart: Date;
    count: bigint;
    walletCount: bigint;
  }>>`
    SELECT 
      "tokenAddress",
      "windowStart",
      COUNT(*) as count,
      COUNT(DISTINCT "walletAddresses") as "walletCount"
    FROM "CoordinatedTrade"
    GROUP BY "tokenAddress", "windowStart"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;
  
  console.log(`Found ${duplicates.length} duplicate groups (token + windowStart)\n`);
  
  if (duplicates.length > 0) {
    console.log('Top duplicates:');
    for (const dup of duplicates.slice(0, 10)) {
      console.log(`- Token: ${dup.tokenAddress}`);
      console.log(`  Window: ${dup.windowStart}`);
      console.log(`  Records: ${dup.count} (${dup.walletCount} unique wallet arrays)`);
      
      // Get sample records
      const records = await prisma.coordinatedTrade.findMany({
        where: {
          tokenAddress: dup.tokenAddress,
          windowStart: dup.windowStart
        },
        select: {
          id: true,
          walletAddresses: true,
          triggeredAt: true
        }
      });
      
      console.log(`  Sample wallets: ${records[0].walletAddresses}`);
      console.log(`  Triggered times: ${records.map(r => r.triggeredAt.toISOString()).join(', ')}`);
      console.log('');
    }
  }
  
  // Check total coordinated trades
  const total = await prisma.coordinatedTrade.count();
  console.log(`\nTotal coordinated trades: ${total}`);
  
  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);
