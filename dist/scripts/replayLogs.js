import "dotenv/config";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { parseHeliusEvent } from "../src/utils/parse.js";
async function main() {
    const logFile = new URL("../logs/events.ndjson", import.meta.url);
    const logPath = logFile.pathname.startsWith("/") && process.platform === "win32"
        ? logFile.pathname.slice(1)
        : logFile.pathname;
    if (!existsSync(logPath)) {
        console.error("No logs found at:", logPath);
        process.exit(1);
    }
    // Load tracked wallets
    const wallets = JSON.parse(readFileSync(new URL("../src/wallets.json", import.meta.url), "utf-8"));
    const tracked = new Set(wallets);
    console.log("Replaying events from:", logPath);
    console.log("Tracked wallets:", wallets.length);
    const rl = createInterface({
        input: createReadStream(logPath, { encoding: "utf8" }),
        crlfDelay: Infinity,
    });
    let lines = 0;
    let parsedTotal = 0;
    let created = 0;
    let duplicates = 0;
    let errors = 0;
    // Use a local Prisma client instance with no engine logs to keep output clean
    const prisma = new PrismaClient();
    for await (const line of rl) {
        if (!line.trim())
            continue;
        lines++;
        let rec;
        try {
            rec = JSON.parse(line);
        }
        catch (e) {
            errors++;
            console.warn("[replay] invalid JSON line", { line: lines, e: e?.message });
            continue;
        }
        const evt = rec?.event ?? rec; // tolerate raw events if present
        const parsed = parseHeliusEvent(evt, tracked);
        parsedTotal += parsed.length;
        for (const p of parsed) {
            try {
                await prisma.transferEvent.create({
                    data: {
                        walletAddress: p.walletAddress,
                        tokenAddress: p.tokenAddress,
                        amount: p.amount,
                        signature: p.signature,
                        timestamp: new Date(p.timestamp),
                        side: p.side,
                    },
                });
                created++;
            }
            catch (e) {
                if (e?.code === "P2002") {
                    duplicates++;
                    continue;
                }
                errors++;
                console.error("[replay] create failed", {
                    walletAddress: p.walletAddress,
                    tokenAddress: p.tokenAddress,
                    signature: p.signature,
                    code: e?.code || e?.name || "unknown",
                    message: e?.message,
                });
            }
        }
    }
    console.log("Replay summary:");
    console.log({ lines, parsedTotal, created, duplicates, errors });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    // Ensure disconnect of local Prisma instance
    try {
        // @ts-ignore
        await prisma.$disconnect();
    }
    catch { }
});
