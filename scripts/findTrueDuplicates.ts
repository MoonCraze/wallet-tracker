import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findTrueDuplicates() {
  console.log("Searching for TRUE duplicates (same wallet + token + signature)...\n");

  // Find any records that violate the unique constraint
  const trueDuplicates = await prisma.$queryRaw<
    Array<{ walletAddress: string; tokenAddress: string; signature: string; cnt: bigint }>
  >`
    SELECT "walletAddress", "tokenAddress", signature, COUNT(*) as cnt 
    FROM "TransferEvent" 
    GROUP BY "walletAddress", "tokenAddress", signature 
    HAVING COUNT(*) > 1 
    LIMIT 50
  `;

  if (trueDuplicates.length === 0) {
    console.log("✅ No true duplicates found!");
    console.log("   All records have unique (wallet, token, signature) combinations.");
  } else {
    console.log(`❌ Found ${trueDuplicates.length} true duplicate groups:\n`);
    
    for (const dup of trueDuplicates) {
      console.log(`Duplicate found:`);
      console.log(`  Wallet: ${dup.walletAddress}`);
      console.log(`  Token: ${dup.tokenAddress}`);
      console.log(`  Signature: ${dup.signature}`);
      console.log(`  Count: ${dup.cnt}\n`);
      
      // Show the actual records
      const records = await prisma.transferEvent.findMany({
        where: {
          walletAddress: dup.walletAddress,
          tokenAddress: dup.tokenAddress,
          signature: dup.signature,
        },
        orderBy: { id: 'asc' }
      });
      
      console.log("  Records:");
      for (const rec of records) {
        console.log(`    ID: ${rec.id}, Amount: ${rec.amount}, Side: ${rec.side}, Time: ${rec.timestamp.toISOString()}`);
      }
      console.log();
    }
    
    console.log("\n⚠️  These are TRUE duplicates and should be removed!");
  }

  await prisma.$disconnect();
}

findTrueDuplicates().catch(console.error);
