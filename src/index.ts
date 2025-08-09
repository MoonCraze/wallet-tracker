import "dotenv/config";
import express from "express";
import { readFileSync } from "node:fs";
import { prisma } from "./db.js";
import { parseHeliusEvent } from "./utils/parse.js";
import { verifyHeliusSecret } from "./verify.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.WEBHOOK_SECRET || "super-secret";

// Load wallets.json without using JSON import assertions (compatible with TS/Node ESM)
const wallets: string[] = JSON.parse(
  readFileSync(new URL("./wallets.json", import.meta.url), "utf-8")
);
// Build a Set for quick membership checks
const tracked = new Set<string>(wallets);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/helius", async (req, res) => {
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

  // Ack quickly on success
  res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error handling webhook:", e);
  // Return 500 so Helius will retry delivery
  res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});