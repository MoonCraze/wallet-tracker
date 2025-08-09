import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/db.js";
async function main() {
    const wallets = JSON.parse(readFileSync(new URL("../src/wallets.json", import.meta.url), "utf-8"));
    const token = process.env.COORD_SAMPLE_TOKEN || "CoordTestMint1111111111111111111111111111111";
    const now = new Date();
    const sigBase = `coord-smoke-${Date.now()}`;
    const ops = wallets.slice(0, 5).map((w, i) => prisma.transferEvent.create({
        data: {
            walletAddress: w,
            tokenAddress: token,
            amount: "1",
            signature: `${sigBase}-${i}`,
            timestamp: new Date(now.getTime() - i * 1_000),
            side: "BUY",
        },
    }));
    const res = await prisma.$transaction(ops);
    console.log(`Inserted ${res.length} BUY events for token ${token}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
