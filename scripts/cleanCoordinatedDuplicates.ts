import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDuplicateCoordinatedTrades() {
  console.log("Cleaning duplicate coordinated trades...\n");

  // Get all coordinated trades
  const allTrades = await prisma.coordinatedTrade.findMany({
    orderBy: [
      { tokenAddress: 'asc' },
      { windowStart: 'asc' },
      { id: 'asc' } // Keep first created (by ID)
    ]
  });

  console.log(`Total coordinated trades: ${allTrades.length}`);

  const uniqueKeys = new Map<string, string>(); // key -> first ID
  const duplicateIds: string[] = [];

  for (const trade of allTrades) {
    const key = `${trade.tokenAddress}|${trade.windowStart.toISOString()}`;
    
    if (!uniqueKeys.has(key)) {
      // First occurrence - keep it
      uniqueKeys.set(key, trade.id);
    } else {
      // Duplicate - mark for deletion
      duplicateIds.push(trade.id);
    }
  }

  console.log(`Unique trades: ${uniqueKeys.size}`);
  console.log(`Duplicates to delete: ${duplicateIds.length}\n`);

  if (duplicateIds.length === 0) {
    console.log("✅ No duplicates found!");
    await prisma.$disconnect();
    return;
  }

  // Delete duplicates in batches
  const BATCH_SIZE = 100;
  let deleted = 0;

  for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + BATCH_SIZE);
    
    try {
      const result = await prisma.coordinatedTrade.deleteMany({
        where: {
          id: { in: batch }
        }
      });
      
      deleted += result.count;
      console.log(`Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} records (${deleted}/${duplicateIds.length})`);
    } catch (error) {
      console.error(`Error deleting batch at index ${i}:`, error);
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deleted} duplicate coordinated trades.`);
  
  // Verify
  const finalCount = await prisma.coordinatedTrade.count();
  console.log(`Final count: ${finalCount}`);
  console.log(`Expected: ${uniqueKeys.size}`);

  await prisma.$disconnect();
}

cleanDuplicateCoordinatedTrades().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
