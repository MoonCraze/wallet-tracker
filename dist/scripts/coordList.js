import "dotenv/config";
import { prisma } from "../src/db.js";
async function main() {
    const rows = await prisma.coordinatedTrade.findMany({
        orderBy: { triggeredAt: "desc" },
        take: 20,
    });
    if (rows.length === 0) {
        console.log("No coordinated trades found");
        return;
    }
    for (const r of rows) {
        console.log(`${r.triggeredAt.toISOString()} | token=${r.tokenAddress} | wallets=${r.uniqueWalletCount} | window=${r.windowStart.toISOString()}..${r.windowEnd.toISOString()}`);
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
