import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  console.log("Scanning for potential duplicate transfers (same wallet|token|signature)...");
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT walletAddress, tokenAddress, signature, COUNT(*) as cnt
     FROM TransferEvent
     GROUP BY walletAddress, tokenAddress, signature
     HAVING cnt > 1
     ORDER BY cnt DESC, signature LIMIT 200;`
  );
  if (!rows || rows.length === 0) {
    console.log("No duplicates found.");
  } else {
    console.log(`Found ${rows.length} duplicate key groups:`);
    for (const r of rows) {
      console.log(`${r.cnt}x | ${r.walletAddress} | ${r.tokenAddress} | ${r.signature}`);
    }
  }

  // Extra check: duplicates by signature only (multiple wallets/tokens with same sig)
  console.log("\nScanning for repeated signatures across different wallet/token pairs...");
  const sigRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT signature, COUNT(*) as cnt
     FROM TransferEvent
     GROUP BY signature
     HAVING cnt > 1
     ORDER BY cnt DESC LIMIT 200;`
  );
  if (!sigRows || sigRows.length === 0) {
    console.log("No repeated signatures.");
  } else {
    console.log(`Found ${sigRows.length} signatures used by multiple rows:`);
    for (const r of sigRows) {
      console.log(`${r.cnt}x | ${r.signature}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
