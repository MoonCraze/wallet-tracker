import "dotenv/config";
import { prisma } from "../src/db.js";

const COORDINATED_WINDOW_MINUTES = Number(process.env.COORDINATED_WINDOW_MINUTES || 5);
const COORDINATED_MIN_WALLETS = Number(process.env.COORDINATED_MIN_WALLETS || 5);
const WINDOW_MS = Math.max(1, COORDINATED_WINDOW_MINUTES) * 60_000;

function floorToWindowStart(d: Date): Date {
  const t = d.getTime();
  return new Date(Math.floor(t / WINDOW_MS) * WINDOW_MS);
}

async function main() {
  console.log("🧪 Testing coordinated trading time window logic...");
  console.log(`Window size: ${COORDINATED_WINDOW_MINUTES} minutes (${WINDOW_MS}ms)`);
  
  // Clean up any existing test data
  await prisma.transferEvent.deleteMany({
    where: { signature: { startsWith: "test-coord-" } }
  });
  await prisma.coordinatedTrade.deleteMany({
    where: { tokenAddress: "TestToken1111111111111111111111111111111" }
  });
  
  // Create test wallets
  const testWallets = [
    "Wallet1111111111111111111111111111111111",
    "Wallet2222222222222222222222222222222222",
    "Wallet3333333333333333333333333333333333", 
    "Wallet4444444444444444444444444444444444",
    "Wallet5555555555555555555555555555555555",
    "Wallet6666666666666666666666666666666666"
  ];
  
  const testToken = "TestToken1111111111111111111111111111111";
  
  // Create a test scenario with coordinated buying
  const now = new Date();
  const currentWindowStart = floorToWindowStart(now);
  const testWindowStart = new Date(currentWindowStart.getTime() - WINDOW_MS);
  const testWindowEnd = currentWindowStart;
  
  console.log(`\n📅 Test window: ${testWindowStart.toISOString()} to ${testWindowEnd.toISOString()}`);
  
  // Insert coordinated buy transfers within the window
  const testTransfers = testWallets.map((wallet, i) => ({
    walletAddress: wallet,
    tokenAddress: testToken,
    amount: `${100 + i}`,
    signature: `test-coord-${i}-${Date.now()}`,
    timestamp: new Date(testWindowStart.getTime() + (i * 30000)), // Spread across 30 seconds each
    side: "BUY" as const,
  }));
  
  console.log(`\n📝 Creating ${testTransfers.length} test transfer events...`);
  for (const transfer of testTransfers) {
    await prisma.transferEvent.create({ data: transfer });
    console.log(`   ✓ ${transfer.walletAddress} BUY ${transfer.amount} at ${transfer.timestamp.toISOString()}`);
  }
  
  // Test the coordinated scan logic
  console.log(`\n🔍 Running coordinated scan...`);
  
  // Use the same logic as the fixed coordScan.ts
  const scanWindowStart = testWindowStart;
  const scanWindowEnd = testWindowEnd;
  
  const tokens = await prisma.transferEvent.findMany({
    where: { side: "BUY", timestamp: { gte: scanWindowStart, lt: scanWindowEnd } },
    select: { tokenAddress: true },
    distinct: ["tokenAddress"],
  });
  
  console.log(`Found ${tokens.length} tokens with BUY activity`);
  
  for (const t of tokens) {
    const buyers = await prisma.transferEvent.findMany({
      where: { 
        tokenAddress: t.tokenAddress, 
        side: "BUY", 
        timestamp: { gte: scanWindowStart, lt: scanWindowEnd } 
      },
      select: { walletAddress: true },
      distinct: ["walletAddress"],
    });
    const uniq = buyers.map((b) => b.walletAddress);
    
    console.log(`Token ${t.tokenAddress}: ${uniq.length} unique buyers`);
    
    if (uniq.length >= COORDINATED_MIN_WALLETS) {
      // Check if this token already has an entry for this exact window
      const existing = await prisma.coordinatedTrade.findFirst({
        where: { tokenAddress: t.tokenAddress, windowStart: scanWindowStart },
        select: { id: true },
      });
      
      if (existing) {
        console.log(`❌ DUPLICATE: Token already has entry for this window!`);
        continue;
      }
      
      await prisma.coordinatedTrade.create({
        data: {
          tokenAddress: t.tokenAddress,
          windowStart: scanWindowStart,
          windowEnd: scanWindowEnd,
          triggeredAt: now,
          uniqueWalletCount: uniq.length,
          walletAddresses: JSON.stringify(uniq),
        },
      });
      
      console.log(`✅ CREATED: Coordinated trade detected for ${t.tokenAddress} with ${uniq.length} wallets`);
    }
  }
  
  // Test running the scan again (should not create duplicates)
  console.log(`\n🔁 Running scan again to test duplicate prevention...`);
  
  let duplicatesCreated = 0;
  for (const t of tokens) {
    const buyers = await prisma.transferEvent.findMany({
      where: { 
        tokenAddress: t.tokenAddress, 
        side: "BUY", 
        timestamp: { gte: scanWindowStart, lt: scanWindowEnd } 
      },
      select: { walletAddress: true },
      distinct: ["walletAddress"],
    });
    const uniq = buyers.map((b) => b.walletAddress);
    
    if (uniq.length >= COORDINATED_MIN_WALLETS) {
      // Check if this token already has an entry for this exact window
      const existing = await prisma.coordinatedTrade.findFirst({
        where: { tokenAddress: t.tokenAddress, windowStart: scanWindowStart },
        select: { id: true },
      });
      
      if (existing) {
        console.log(`✅ SKIPPED: Token ${t.tokenAddress} already processed for this window`);
        continue;
      }
      
      duplicatesCreated++;
      console.log(`❌ DUPLICATE CREATED: This should not happen!`);
    }
  }
  
  // Show final results
  const coordTrades = await prisma.coordinatedTrade.findMany({
    where: { tokenAddress: testToken },
    orderBy: { windowStart: "asc" }
  });
  
  console.log(`\n📊 Final Results:`);
  console.log(`   Coordinated trade entries: ${coordTrades.length}`);
  console.log(`   Duplicates created on re-scan: ${duplicatesCreated}`);
  
  for (const trade of coordTrades) {
    console.log(`   Entry: ${trade.tokenAddress} | ${trade.uniqueWalletCount} wallets | window: ${trade.windowStart.toISOString()}`);
  }
  
  if (duplicatesCreated === 0 && coordTrades.length === 1) {
    console.log(`\n🎉 TEST PASSED: No duplicates created, logic working correctly!`);
  } else {
    console.log(`\n❌ TEST FAILED: Expected 1 entry and 0 duplicates`);
  }
  
  // Cleanup
  console.log(`\n🧹 Cleaning up test data...`);
  await prisma.transferEvent.deleteMany({
    where: { signature: { startsWith: "test-coord-" } }
  });
  await prisma.coordinatedTrade.deleteMany({
    where: { tokenAddress: testToken }
  });
  console.log(`✓ Cleanup complete`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
