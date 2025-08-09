import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  const rows = await prisma.transferEvent.findMany({
    orderBy: { timestamp: "desc" },
    take: 10,
  });
  console.log(`Latest ${rows.length} rows:`);
  for (const r of rows) {
    console.log(`${r.timestamp.toISOString()} | ${r.walletAddress} | ${r.tokenAddress} | ${r.side} ${r.amount} | ${r.signature}`);
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
