import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log("Checking for duplicate transfers...\n");

  // Check duplicates by signature only
  const duplicateSigs = await prisma.$queryRaw<Array<{ signature: string; cnt: bigint }>>`
    SELECT signature, COUNT(*) as cnt 
    FROM "TransferEvent" 
    GROUP BY signature 
    HAVING COUNT(*) > 1 
    ORDER BY cnt DESC 
    LIMIT 20
  `;

  console.log("=== Transactions with Multiple Token Transfers ===");
  console.log("(Note: These are NOT duplicates - one transaction can contain multiple token transfers)\n");
  if (duplicateSigs.length === 0) {
    console.log("✅ No multi-token transactions found");
  } else {
    console.log(`ℹ️  Found ${duplicateSigs.length} transactions with multiple tokens:`);
    for (const row of duplicateSigs) {
      console.log(`  - ${row.signature}: ${row.cnt} occurrences`);
      
      // Show the actual duplicate records
      const records = await prisma.transferEvent.findMany({
        where: { signature: row.signature },
        select: {
          id: true,
          walletAddress: true,
          tokenAddress: true,
          signature: true,
          timestamp: true,
          side: true,
          amount: true,
        },
      });
      
      console.log("    Records:");
      for (const rec of records) {
        console.log(`      ID: ${rec.id}, Wallet: ${rec.walletAddress.slice(0, 8)}..., Token: ${rec.tokenAddress.slice(0, 8)}..., Side: ${rec.side}, Amount: ${rec.amount}, Time: ${rec.timestamp.toISOString()}`);
      }
      console.log();
    }
  }

  // Check duplicates by composite key (wallet + token + signature)
  const duplicateComposite = await prisma.$queryRaw<Array<{ walletAddress: string; tokenAddress: string; signature: string; cnt: bigint }>>`
    SELECT "walletAddress", "tokenAddress", signature, COUNT(*) as cnt 
    FROM "TransferEvent" 
    GROUP BY "walletAddress", "tokenAddress", signature 
    HAVING COUNT(*) > 1 
    ORDER BY cnt DESC 
    LIMIT 20
  `;

  console.log("\n=== Duplicates by Composite Key (wallet + token + signature) ===");
  if (duplicateComposite.length === 0) {
    console.log("✅ No duplicates found by composite key");
  } else {
    console.log(`❌ Found ${duplicateComposite.length} composite keys with duplicates:`);
    for (const row of duplicateComposite) {
      console.log(`  - Wallet: ${row.walletAddress.slice(0, 8)}..., Token: ${row.tokenAddress.slice(0, 8)}..., Sig: ${row.signature.slice(0, 8)}...: ${row.cnt} occurrences`);
    }
  }

  // Total count statistics
  const total = await prisma.transferEvent.count();
  const uniqueSigs = await prisma.transferEvent.findMany({
    select: { signature: true },
    distinct: ['signature'],
  });
  
  console.log("\n=== Statistics ===");
  console.log(`Total transfer records: ${total}`);
  console.log(`Unique transactions (signatures): ${uniqueSigs.length}`);
  console.log(`Avg transfers per transaction: ${(total / uniqueSigs.length).toFixed(2)}`);
  
  if (total !== uniqueSigs.length) {
    console.log(`\nℹ️  ${total - uniqueSigs.length} records represent multi-token transfers in single transactions`);
    console.log("   This is NORMAL Solana behavior - not duplicates!");
  }

  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);
