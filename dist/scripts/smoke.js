import "dotenv/config";
import axios from "axios";
import { readFileSync } from "node:fs";
import { prisma } from "../src/db.js";
async function main() {
    const wallets = JSON.parse(readFileSync(new URL("../src/wallets.json", import.meta.url), "utf-8"));
    const to = wallets[0];
    const signature = `test-${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    // Post a minimal enhanced webhook-like payload
    await axios.post("http://localhost:" + (process.env.PORT || 8080) + "/helius", {
        type: "TEST",
        signature,
        timestamp,
        tokenTransfers: [
            {
                fromUserAccount: "Sender1111111111111111111111111111111111",
                toUserAccount: to,
                mint: "TestMint1111111111111111111111111111111111",
                tokenAmount: "1.23",
            },
        ],
    }, {
        headers: { "x-helius-secret": process.env.WEBHOOK_SECRET || "super-secret" },
    });
    // Give the server a tick to write
    await new Promise((r) => setTimeout(r, 200));
    const rows = await prisma.transferEvent.findMany({ where: { signature } });
    console.log("Rows for signature:", signature, rows.length);
    if (rows.length === 0) {
        console.error("Smoke test FAILED: no rows found");
        process.exit(1);
    }
    console.log(rows[0]);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
