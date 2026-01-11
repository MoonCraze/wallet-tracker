import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log("Starting duplicate cleanup...\n");

  // Get all records grouped by composite key
  const allRecords = await prisma.transferEvent.findMany({
    orderBy: [
      { walletAddress: 'asc' },
      { tokenAddress: 'asc' },
      { signature: 'asc' },
      { id: 'asc' } // Keep the first inserted record
    ]
  });

  console.log(`Total records: ${allRecords.length}`);

  const uniqueKeys = new Map<string, string>(); // key -> first ID
  const duplicateIds: string[] = [];

  for (const record of allRecords) {
    const key = `${record.walletAddress}|${record.tokenAddress}|${record.signature}`;
    
    if (!uniqueKeys.has(key)) {
      // First occurrence - keep it
      uniqueKeys.set(key, record.id);
    } else {
      // Duplicate - mark for deletion
      duplicateIds.push(record.id);
    }
  }

  console.log(`Unique records: ${uniqueKeys.size}`);
  console.log(`Duplicate records to delete: ${duplicateIds.length}\n`);

  if (duplicateIds.length === 0) {
    console.log("✅ No duplicates found!");
    await prisma.$disconnect();
    return;
  }

  // Delete duplicates in batches to avoid overwhelming the database
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
    const batch = duplicateIds.slice(i, i + BATCH_SIZE);
    
    try {
      const result = await prisma.transferEvent.deleteMany({
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

  console.log(`\n✅ Cleanup complete! Deleted ${deleted} duplicate records.`);
  
  // Verify
  const finalCount = await prisma.transferEvent.count();
  console.log(`Final record count: ${finalCount}`);

  await prisma.$disconnect();
}

cleanDuplicates().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
