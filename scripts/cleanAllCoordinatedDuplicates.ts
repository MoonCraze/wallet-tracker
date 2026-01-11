import { prisma } from '../src/db';

async function cleanDuplicates() {
  console.log('Finding and removing duplicate coordinated trades...\n');
  
  // Find all groups with duplicates
  const duplicates = await prisma.$queryRaw<Array<{
    tokenAddress: string;
    windowStart: Date;
    count: bigint;
  }>>`
    SELECT 
      "tokenAddress",
      "windowStart",
      COUNT(*) as count
    FROM "CoordinatedTrade"
    GROUP BY "tokenAddress", "windowStart"
    HAVING COUNT(*) > 1
  `;
  
  console.log(`Found ${duplicates.length} duplicate groups\n`);
  
  let totalDeleted = 0;
  
  for (const dup of duplicates) {
    // Get all records for this group, ordered by triggeredAt (keep earliest)
    const records = await prisma.coordinatedTrade.findMany({
      where: {
        tokenAddress: dup.tokenAddress,
        windowStart: dup.windowStart
      },
      orderBy: {
        triggeredAt: 'asc'
      }
    });
    
    // Keep the first one, delete the rest
    const toDelete = records.slice(1).map(r => r.id);
    
    if (toDelete.length > 0) {
      await prisma.coordinatedTrade.deleteMany({
        where: {
          id: { in: toDelete }
        }
      });
      
      totalDeleted += toDelete.length;
      console.log(`Cleaned ${toDelete.length} duplicates for token ${dup.tokenAddress} at ${dup.windowStart}`);
    }
  }
  
  console.log(`\n✅ Deleted ${totalDeleted} duplicate records`);
  
  // Verify no duplicates remain
  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM "CoordinatedTrade"
    GROUP BY "tokenAddress", "windowStart"
    HAVING COUNT(*) > 1
  `;
  
  console.log(`Remaining duplicate groups: ${remaining.length}`);
  
  await prisma.$disconnect();
}

cleanDuplicates().catch(console.error);
