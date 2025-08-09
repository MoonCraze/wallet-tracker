import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { readFileSync } from "node:fs";
import { prisma } from "./db.js";
import { parseHeliusEvent } from "./utils/parse.js";
import { verifyHeliusSecret } from "./verify.js";

const app = express();

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.WEBHOOK_SECRET || "super-secret";
const DEBUG_EVENTS = process.env.DEBUG_EVENTS === "1" || process.env.DEBUG_EVENTS === "true";

// Load wallets.json without using JSON import assertions (compatible with TS/Node ESM)
const wallets: string[] = JSON.parse(
  readFileSync(new URL("./wallets.json", import.meta.url), "utf-8")
);
// Build a Set for quick membership checks
const tracked = new Set<string>(wallets);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Parse JSON only for the webhook route to avoid parsing unrelated requests
app.post(
  "/helius",
  express.json({ limit: "10mb", type: ["application/json", "application/*+json"] }),
  async (req, res) => {
  // Verify request
  if (!verifyHeliusSecret(req, SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // Helius may POST either a single event object or an array of events
  const body = req.body;
  const events = Array.isArray(body) ? body : [body];

  try {
    for (const evt of events) {
  const parsed = parseHeliusEvent(evt, tracked);
      if (parsed.length === 0) continue;

      for (const p of parsed) {
        await prisma.transferEvent.upsert({
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
        });
      }
    }

    if (DEBUG_EVENTS && (!events || events.length === 0)) {
      console.log("[debug] webhook received empty events array");
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
});