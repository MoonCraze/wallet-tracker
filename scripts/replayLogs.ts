import "dotenv/config";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { parseHeliusEvent, WSOL_MINT } from "../src/utils/parse.js";

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
  const wallets: string[] = JSON.parse(
    readFileSync(new URL("../src/wallets.json", import.meta.url), "utf-8")
  );
  const tracked = new Set<string>(wallets);

  // Config mirrors server: EXCLUDE_TOKENS and MIN_AMOUNT
  const EXCLUDE_TOKENS: Set<string> = new Set(
    (process.env.EXCLUDE_TOKENS || WSOL_MINT)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const MIN_AMOUNT: number = (() => {
    const v = parseFloat(process.env.MIN_AMOUNT || "1");
    return Number.isFinite(v) ? v : 1;
  })();
  const DEDUP_BY_SIGNATURE_ONLY = process.env.DEDUP_BY_SIGNATURE_ONLY === "1" || process.env.DEDUP_BY_SIGNATURE_ONLY === "true";

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
    if (!line.trim()) continue;
    lines++;
    let rec: any;
    try {
      rec = JSON.parse(line);
    } catch (e) {
      errors++;
      console.warn("[replay] invalid JSON line", { line: lines, e: (e as any)?.message });
      continue;
    }
    const evt = rec?.event ?? rec; // tolerate raw events if present
    const parsed = parseHeliusEvent(evt, tracked);
    const filtered = parsed.filter((p) => {
      if (EXCLUDE_TOKENS.has(p.tokenAddress)) return false;
      const amt = Math.abs(Number(p.amount));
      if (!Number.isFinite(amt) || amt < MIN_AMOUNT) return false;
      return true;
    });
    parsedTotal += parsed.length;
    // Deduplicate within this line's event
    const unique = new Map<string, typeof filtered[number]>();
    for (const p of filtered) {
      const key = DEDUP_BY_SIGNATURE_ONLY
        ? p.signature
        : `${p.walletAddress}|${p.tokenAddress}|${p.signature}`;
      if (!unique.has(key)) unique.set(key, p);
    }
    const toWrite = Array.from(unique.values());
    if (toWrite.length > 0) {
      const ops = toWrite.map((p) =>
        prisma.transferEvent.upsert({
          where: {
            wallet_token_sig_unique: {
              walletAddress: p.walletAddress,
              tokenAddress: p.tokenAddress,
              signature: p.signature,
            },
          },
          update: {},
          create: {
            walletAddress: p.walletAddress,
            tokenAddress: p.tokenAddress,
            amount: p.amount,
            signature: p.signature,
            timestamp: new Date(p.timestamp),
            side: p.side,
          },
        })
      );
      try {
        await prisma.$transaction(ops);
        created += toWrite.length; // either created or matched existing; treat as handled
      } catch (e: any) {
        // If transaction fails, fall back to sequential upserts to continue progress
        for (const op of ops) {
          try {
            await op;
            created++;
          } catch (e2: any) {
            // Count as error; upsert should not P2002
            errors++;
          }
        }
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
    } catch {}
  });
