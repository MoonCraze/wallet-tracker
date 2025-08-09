import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { prisma } from "./db.js";
import { parseHeliusEvent, WSOL_MINT } from "./utils/parse.js";
import { verifyHeliusSecret } from "./verify.js";

const app = express();

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.WEBHOOK_SECRET || "super-secret";
const DEBUG_EVENTS = process.env.DEBUG_EVENTS === "1" || process.env.DEBUG_EVENTS === "true";
const DEBUG_EVENTS_VERBOSE = process.env.DEBUG_EVENTS_VERBOSE === "1" || process.env.DEBUG_EVENTS_VERBOSE === "true";

// Load wallets.json without using JSON import assertions (compatible with TS/Node ESM)
const wallets: string[] = JSON.parse(
  readFileSync(new URL("./wallets.json", import.meta.url), "utf-8")
);
// Build a Set for quick membership checks
const tracked = new Set<string>(wallets);

// Config: token exclusion and minimum amount threshold (default: exclude SOL and < 1)
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
// Optional coarser dedup mode: treat signature as unique regardless of token/wallet
const DEDUP_BY_SIGNATURE_ONLY = process.env.DEDUP_BY_SIGNATURE_ONLY === "1" || process.env.DEDUP_BY_SIGNATURE_ONLY === "true";

// Coordinated trading detection config
const COORDINATED_WINDOW_MINUTES = Number(process.env.COORDINATED_WINDOW_MINUTES || 5);
const COORDINATED_MIN_WALLETS = Number(process.env.COORDINATED_MIN_WALLETS || 5);
const WINDOW_MS = Math.max(1, COORDINATED_WINDOW_MINUTES) * 60_000;

function floorToWindowStart(d: Date): Date {
  const t = d.getTime();
  return new Date(Math.floor(t / WINDOW_MS) * WINDOW_MS);
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// Surface DB path and CWD up front to catch env/path mismatches
if (DEBUG_EVENTS) {
  console.log("[boot] cwd:", process.cwd());
  console.log("[boot] DATABASE_URL:", process.env.DATABASE_URL || "(not set)");
}

// Parse JSON only for the webhook route to avoid parsing unrelated requests
app.post(
  "/helius",
  express.json({ limit: "10mb", type: ["application/json", "application/*+json"] }),
  async (req, res) => {
  // Basic request log (no secrets)
  const recvAt = new Date().toISOString();
  const hdr = req.headers || {};
  const authHdr = typeof hdr["authorization"] === "string" ? (hdr["authorization"] as string) : undefined;
  const redactedAuth = authHdr ? `${authHdr.split(" ")[0]} ******` : undefined;
  if (DEBUG_EVENTS) {
    console.log(`[webhook] ${recvAt} request received`);
  }

  // Verify request
  const authorized = verifyHeliusSecret(req, SECRET);
  if (!authorized) {
    if (DEBUG_EVENTS) {
      console.warn("[webhook] unauthorized request", {
        hasXHeliusSecret: typeof hdr["x-helius-secret"] === "string",
        authorization: redactedAuth,
        contentType: hdr["content-type"],
      });
      // Optionally log body for debugging
      try {
        const bodyPreview = typeof req.body === "object" ? JSON.stringify(req.body).slice(0, 2000) : String(req.body).slice(0, 2000);
        console.log("[webhook] unauthorized body preview:", bodyPreview);
      } catch {}
    }
    return res.status(401).json({ error: "unauthorized" });
  }

  // Helius may POST either a single event object or an array of events
  const body = req.body;
  const events = Array.isArray(body) ? body : [body];

  // Persist raw webhook payload for offline debugging (ndjson per event)
  if (DEBUG_EVENTS) {
    try {
      const logDir = joinPath(process.cwd(), "logs");
      mkdirSync(logDir, { recursive: true });
      const file = joinPath(logDir, "events.ndjson");
      for (const evt of events) {
        const record = {
          recvAt,
          headers: {
            contentType: hdr["content-type"],
            hasXHeliusSecret: typeof hdr["x-helius-secret"] === "string",
            authorization: redactedAuth,
          },
          event: evt,
        };
        appendFileSync(file, JSON.stringify(record) + "\n", "utf8");
      }
      console.log(`[webhook] logged ${events.length} event(s) to logs/events.ndjson`);
    } catch (e) {
      console.warn("[webhook] failed to write webhook logs:", e);
    }
  }

  try {
    // Collect tokens that had BUY events in this batch to check coordination per token over last window
    const touchedTokens = new Set<string>();
    for (const evt of events) {
      if (DEBUG_EVENTS) {
        const keys = evt && typeof evt === "object" ? Object.keys(evt as any) : [];
        console.log("[webhook] event keys:", keys.slice(0, 20));
      }
      const parsed = parseHeliusEvent(evt, tracked);
      // Apply filters: exclude common tokens and small amounts
      const filtered = parsed.filter((p) => {
        if (EXCLUDE_TOKENS.has(p.tokenAddress)) {
          if (DEBUG_EVENTS_VERBOSE) {
            console.log("[filter] exclude token", { tokenAddress: p.tokenAddress, signature: p.signature });
          }
          return false;
        }
        const amt = Math.abs(Number(p.amount));
        if (!Number.isFinite(amt) || amt < MIN_AMOUNT) {
          if (DEBUG_EVENTS_VERBOSE) {
            console.log("[filter] below min amount", { amount: p.amount, min: MIN_AMOUNT, signature: p.signature });
          }
          return false;
        }
        return true;
      });
      if (DEBUG_EVENTS) {
        console.log(`[webhook] parsed transfers: ${parsed.length}`);
        if (parsed.length > 0) {
          const peek = filtered.slice(0, 2).map(p => ({
            walletAddress: p.walletAddress,
            tokenAddress: p.tokenAddress,
            amount: p.amount,
            side: p.side,
            signature: p.signature,
          }));
          console.log("[webhook] parsed sample:", peek);
          const dropped = parsed.length - filtered.length;
          if (dropped > 0) console.log(`[webhook] filtered out: ${dropped}`);
        }
      }
      if (filtered.length === 0) continue;

      // Deduplicate within this payload by (walletAddress, tokenAddress, signature)
      const unique = new Map<string, typeof filtered[number]>();
      for (const p of filtered) {
        const key = DEDUP_BY_SIGNATURE_ONLY
          ? p.signature
          : `${p.walletAddress}|${p.tokenAddress}|${p.signature}`;
        if (!unique.has(key)) unique.set(key, p);
      }
      const toWrite = Array.from(unique.values());

      // Upsert with compound unique key to avoid exceptions on duplicates
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
  let wrote = 0;
      try {
        const res = await prisma.$transaction(ops);
        wrote = res.length; // all succeeded; upsert returns existing or created
      } catch (e) {
        // Fall back to sequential to surface any unexpected issues without aborting all
        wrote = 0;
        for (const op of ops) {
          try {
            await op;
            wrote++;
          } catch (err) {
            if (DEBUG_EVENTS_VERBOSE) console.warn("[db] upsert failed for one row", err);
          }
        }
      }
      if (DEBUG_EVENTS) console.log(`[webhook] upserts succeeded: ${wrote}/${toWrite.length}`);

      // Record token for BUY side only to check coordination
      for (const p of toWrite) {
        if (p.side === "BUY") touchedTokens.add(p.tokenAddress);
      }
    }

    if (DEBUG_EVENTS && (!events || events.length === 0)) {
      console.log("[webhook] received empty events array");
    }

    // After processing all events, check coordinated buys per token over the last window [now-W, now)
    const now = new Date();
    const start = new Date(now.getTime() - WINDOW_MS);
    const windowStart = floorToWindowStart(now);
    const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);
    for (const tokenAddress of touchedTokens) {
      const rows = await prisma.transferEvent.findMany({
        where: { tokenAddress, side: "BUY", timestamp: { gte: start, lt: now } },
        select: { walletAddress: true },
      });
      const uniq = Array.from(new Set(rows.map(r => r.walletAddress))).sort();
      if (uniq.length >= COORDINATED_MIN_WALLETS) {
        try {
          const existing = await prisma.coordinatedTrade.findFirst({
            where: { tokenAddress, windowStart },
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
                tokenAddress,
                windowStart,
                windowEnd,
                triggeredAt: now,
                uniqueWalletCount: uniq.length,
                walletAddresses: JSON.stringify(uniq),
              },
            });
          }
          if (DEBUG_EVENTS) {
            console.log("[coord] detected coordinated BUY:", {
              token: tokenAddress,
              windowStart: windowStart.toISOString(),
              count: uniq.length,
            });
          }
        } catch (e) {
          if (DEBUG_EVENTS) console.warn("[coord] upsert failed", e);
        }
      }
    }

    // Ack quickly on success
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error handling webhook:", e);
  // Return 500 so Helius will retry delivery
  res.status(500).json({ ok: false });
  }
  }
);

// Gracefully handle body parsing errors and aborted requests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function bodyParseErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (!err) return next();
  const msg = (err && (err.message || "")).toLowerCase();
  const type = (err && (err.type || "")).toLowerCase();
  if (
    msg.includes("request aborted") ||
    type.includes("aborted") ||
    type.includes("entity.too.large") ||
    err instanceof SyntaxError
  ) {
    return res.status(400).json({ error: "invalid request body" });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
  console.log("[config]", {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT,
    EXCLUDE_TOKENS: Array.from(EXCLUDE_TOKENS),
    MIN_AMOUNT,
    DEDUP_BY_SIGNATURE_ONLY,
    COORDINATED_WINDOW_MINUTES,
    COORDINATED_MIN_WALLETS,
    DEBUG_EVENTS,
    DEBUG_EVENTS_VERBOSE,
  });
  // Background scanner: periodically scan the last window for coordinated buys
  const intervalMs = Math.min(60_000, Math.max(10_000, Math.floor(WINDOW_MS / 2)));
  const scan = async () => {
    try {
      const now = new Date();
      const start = new Date(now.getTime() - WINDOW_MS);
      const end = now;
      // Find tokens with BUYs in the window
      const tokenRows = await prisma.transferEvent.findMany({
        where: { side: "BUY", timestamp: { gte: start, lt: end } },
        select: { tokenAddress: true },
        distinct: ["tokenAddress"],
      });
      for (const tr of tokenRows) {
        const token = tr.tokenAddress;
        const buyers = await prisma.transferEvent.findMany({
          where: { tokenAddress: token, side: "BUY", timestamp: { gte: start, lt: end } },
          select: { walletAddress: true },
          distinct: ["walletAddress"],
        });
        const uniq = buyers.map(b => b.walletAddress);
        if (uniq.length >= COORDINATED_MIN_WALLETS) {
          const windowStart = floorToWindowStart(start);
          const windowEnd = new Date(windowStart.getTime() + WINDOW_MS);
          const existing = await prisma.coordinatedTrade.findFirst({
            where: { tokenAddress: token, windowStart },
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
                tokenAddress: token,
                windowStart,
                windowEnd,
                triggeredAt: now,
                uniqueWalletCount: uniq.length,
                walletAddresses: JSON.stringify(uniq),
              },
            });
          }
          if (DEBUG_EVENTS) {
            console.log("[coord/bg] coordinated BUY:", {
              token,
              windowStart: windowStart.toISOString(),
              count: uniq.length,
            });
          }
        }
      }
    } catch (e) {
      if (DEBUG_EVENTS) console.warn("[coord/bg] scan failed", e);
    }
  };
  // Run soon after start then on interval
  scan();
  setInterval(scan, intervalMs);
});