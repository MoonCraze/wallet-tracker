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
  const start = new Date(now.getTime() - WINDOW_MS);
  const end = now;
  const tokens = await prisma.transferEvent.findMany({
    where: { side: "BUY", timestamp: { gte: start, lt: end } },
    select: { tokenAddress: true },
    distinct: ["tokenAddress"],
  });
  for (const t of tokens) {
    const buyers = await prisma.transferEvent.findMany({
      where: { tokenAddress: t.tokenAddress, side: "BUY", timestamp: { gte: start, lt: end } },
      select: { walletAddress: true },
      distinct: ["walletAddress"],
    });
    const uniq = buyers.map((b) => b.walletAddress);
    if (uniq.length >= COORDINATED_MIN_WALLETS) {
      const windowStart = floorToWindowStart(start);
      const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);
      const existing = await prisma.coordinatedTrade.findFirst({
        where: { tokenAddress: t.tokenAddress, windowStart },
        select: { id: true },
      });
      if (existing) {
        await prisma.coordinatedTrade.update({
          where: { id: existing.id },
          data: {
            uniqueWalletCount: uniq.length,
            walletAddresses: JSON.stringify(uniq),
            windowEnd,
            triggeredAt: now,
          },
        });
      } else {
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
      }
      console.log(`[coord/scan] token=${t.tokenAddress} wallets=${uniq.length}`);
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
