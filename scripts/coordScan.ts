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
  const now = new Date();
  
  // Use a fixed window approach: align to WINDOW_MS boundaries
  const currentWindowStart = floorToWindowStart(now);
  const windowStart = new Date(currentWindowStart.getTime() - WINDOW_MS);
  const windowEnd = currentWindowStart;
  
  console.log(`[coord/scan] scanning window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
  
  // Check if we already processed this window (prevent duplicate processing)
  const existingWindowCheck = await prisma.coordinatedTrade.findFirst({
    where: { windowStart },
    select: { id: true },
  });
  
  if (existingWindowCheck) {
    console.log(`[coord/scan] window already processed, skipping`);
    return;
  }
  
  const tokens = await prisma.transferEvent.findMany({
    where: { side: "BUY", timestamp: { gte: windowStart, lt: windowEnd } },
    select: { tokenAddress: true },
    distinct: ["tokenAddress"],
  });
  
  console.log(`[coord/scan] found ${tokens.length} unique tokens with BUY activity`);
  
  for (const t of tokens) {
    const buyers = await prisma.transferEvent.findMany({
      where: { 
        tokenAddress: t.tokenAddress, 
        side: "BUY", 
        timestamp: { gte: windowStart, lt: windowEnd } 
      },
      select: { walletAddress: true },
      distinct: ["walletAddress"],
    });
    const uniq = buyers.map((b) => b.walletAddress);
    
    if (uniq.length >= COORDINATED_MIN_WALLETS) {
      // Check if this token already has an entry for this exact window
      const existing = await prisma.coordinatedTrade.findFirst({
        where: { tokenAddress: t.tokenAddress, windowStart },
        select: { id: true },
      });
      
      if (existing) {
        console.log(`[coord/scan] token=${t.tokenAddress} already has entry for this window, skipping`);
        continue;
      }
      
      await prisma.coordinatedTrade.create({
        data: {
          tokenAddress: t.tokenAddress,
          windowStart,
          windowEnd,
          triggeredAt: now,
          uniqueWalletCount: uniq.length,
          walletAddresses: JSON.stringify(uniq),
        },
      });
      
      console.log(`[coord/scan] token=${t.tokenAddress} wallets=${uniq.length} window=${windowStart.toISOString()}`);
    }
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
