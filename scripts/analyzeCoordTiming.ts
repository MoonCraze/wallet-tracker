import "dotenv/config";
import { prisma } from "../src/db.js";

const COORDINATED_WINDOW_MINUTES = Number(process.env.COORDINATED_WINDOW_MINUTES || 5);
const WINDOW_MS = Math.max(1, COORDINATED_WINDOW_MINUTES) * 60_000;

async function main() {
  console.log("Analyzing coordinated trade time windows for overlaps...");
  console.log(`Window size: ${COORDINATED_WINDOW_MINUTES} minutes (${WINDOW_MS}ms)`);
  
  // Get all coordinated trades
  const allTrades = await prisma.coordinatedTrade.findMany({
    orderBy: [{ tokenAddress: "asc" }, { windowStart: "asc" }],
  });
  
  console.log(`Total coordinated trade entries: ${allTrades.length}`);
  
  if (allTrades.length === 0) {
    console.log("No coordinated trades found to analyze.");
    return;
  }
  
  // Group by token
  const byToken = new Map<string, typeof allTrades>();
  for (const trade of allTrades) {
    if (!byToken.has(trade.tokenAddress)) {
      byToken.set(trade.tokenAddress, []);
    }
    byToken.get(trade.tokenAddress)!.push(trade);
  }
  
  console.log(`\nTokens with coordinated trading: ${byToken.size}`);
  
  let totalOverlaps = 0;
  let tokensWithOverlaps = 0;
  
  // Analyze each token's time windows
  for (const [tokenAddress, trades] of byToken.entries()) {
    if (trades.length <= 1) continue;
    
    // Sort by window start time
    trades.sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime());
    
    const overlaps: Array<{prev: typeof trades[0], current: typeof trades[0], gap: number}> = [];
    
    for (let i = 1; i < trades.length; i++) {
      const prev = trades[i - 1];
      const current = trades[i];
      
      const prevEnd = prev.windowEnd.getTime();
      const currentStart = current.windowStart.getTime();
      const gap = currentStart - prevEnd;
      
      // Check for overlaps or suspicious gaps
      if (gap < WINDOW_MS && gap !== 0) {
        overlaps.push({ prev, current, gap });
      }
    }
    
    if (overlaps.length > 0) {
      tokensWithOverlaps++;
      totalOverlaps += overlaps.length;
      
      console.log(`\n🔍 Token: ${tokenAddress}`);
      console.log(`   Total entries: ${trades.length}`);
      console.log(`   Overlapping/suspicious windows: ${overlaps.length}`);
      
      for (const overlap of overlaps) {
        const gapMinutes = Math.round(overlap.gap / (1000 * 60) * 100) / 100;
        console.log(`   ⚠️  Window gap: ${gapMinutes} minutes`);
        console.log(`      Previous: ${overlap.prev.windowStart.toISOString()} → ${overlap.prev.windowEnd.toISOString()} (${overlap.prev.uniqueWalletCount} wallets)`);
        console.log(`      Current:  ${overlap.current.windowStart.toISOString()} → ${overlap.current.windowEnd.toISOString()} (${overlap.current.uniqueWalletCount} wallets)`);
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Tokens with overlapping windows: ${tokensWithOverlaps}/${byToken.size}`);
  console.log(`   Total overlapping window pairs: ${totalOverlaps}`);
  
  if (totalOverlaps > 0) {
    console.log(`\n💡 Recommendation: Run the dedupeCoorded.ts script to clean up duplicate entries.`);
  }
  
  // Show recent entries for context
  console.log(`\n📋 Most recent 5 coordinated trade entries:`);
  const recent = await prisma.coordinatedTrade.findMany({
    orderBy: { triggeredAt: "desc" },
    take: 5,
  });
  
  for (const entry of recent) {
    console.log(`   ${entry.triggeredAt.toISOString()} | ${entry.tokenAddress} | ${entry.uniqueWalletCount} wallets | window: ${entry.windowStart.toISOString()}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
