import "dotenv/config";
import { prisma } from "../src/db.js";
async function main() {
    console.log("Scanning for duplicate coordinated trade entries...");
    // Find all coordinated trades grouped by token and window
    const allTrades = await prisma.coordinatedTrade.findMany({
        orderBy: [{ tokenAddress: "asc" }, { windowStart: "asc" }, { triggeredAt: "asc" }],
    });
    const duplicateGroups = new Map();
    // Group by token + windowStart
    for (const trade of allTrades) {
        const key = `${trade.tokenAddress}-${trade.windowStart.getTime()}`;
        if (!duplicateGroups.has(key)) {
            duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key).push(trade);
    }
    // Find groups with duplicates
    const duplicates = Array.from(duplicateGroups.entries())
        .filter(([_, trades]) => trades.length > 1);
    if (duplicates.length === 0) {
        console.log("No duplicate coordinated trade entries found.");
        return;
    }
    console.log(`Found ${duplicates.length} groups with duplicate entries:`);
    let totalDuplicatesRemoved = 0;
    for (const [key, trades] of duplicates) {
        console.log(`\nDuplicate group: ${key}`);
        console.log(`  Found ${trades.length} entries:`);
        // Sort by triggeredAt to keep the earliest entry
        trades.sort((a, b) => a.triggeredAt.getTime() - b.triggeredAt.getTime());
        for (let i = 0; i < trades.length; i++) {
            const trade = trades[i];
            const status = i === 0 ? "KEEP" : "DELETE";
            console.log(`    ${status}: ID=${trade.id}, triggered=${trade.triggeredAt.toISOString()}, wallets=${trade.uniqueWalletCount}`);
        }
        // Delete all but the first (earliest) entry
        const toDelete = trades.slice(1);
        if (toDelete.length > 0) {
            const deleteIds = toDelete.map(t => t.id);
            await prisma.coordinatedTrade.deleteMany({
                where: { id: { in: deleteIds } }
            });
            totalDuplicatesRemoved += toDelete.length;
            console.log(`    Deleted ${toDelete.length} duplicate entries`);
        }
    }
    console.log(`\nCleanup complete. Removed ${totalDuplicatesRemoved} duplicate entries.`);
    // Show summary of remaining entries
    const remaining = await prisma.coordinatedTrade.count();
    console.log(`Remaining coordinated trade entries: ${remaining}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
