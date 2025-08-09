import "dotenv/config";
import express from "express";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { prisma } from "./db.js";
import { parseHeliusEvent } from "./utils/parse.js";
import { verifyHeliusSecret } from "./verify.js";
const app = express();
const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.WEBHOOK_SECRET || "super-secret";
const DEBUG_EVENTS = process.env.DEBUG_EVENTS === "1" || process.env.DEBUG_EVENTS === "true";
const DEBUG_EVENTS_VERBOSE = process.env.DEBUG_EVENTS_VERBOSE === "1" || process.env.DEBUG_EVENTS_VERBOSE === "true";
// Load wallets.json without using JSON import assertions (compatible with TS/Node ESM)
const wallets = JSON.parse(readFileSync(new URL("./wallets.json", import.meta.url), "utf-8"));
// Build a Set for quick membership checks
const tracked = new Set(wallets);
app.get("/health", (_req, res) => res.json({ ok: true }));
// Surface DB path and CWD up front to catch env/path mismatches
if (DEBUG_EVENTS) {
    console.log("[boot] cwd:", process.cwd());
    console.log("[boot] DATABASE_URL:", process.env.DATABASE_URL || "(not set)");
}
// Parse JSON only for the webhook route to avoid parsing unrelated requests
app.post("/helius", express.json({ limit: "10mb", type: ["application/json", "application/*+json"] }), async (req, res) => {
    // Basic request log (no secrets)
    const recvAt = new Date().toISOString();
    const hdr = req.headers || {};
    const authHdr = typeof hdr["authorization"] === "string" ? hdr["authorization"] : undefined;
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
            }
            catch { }
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
        }
        catch (e) {
            console.warn("[webhook] failed to write webhook logs:", e);
        }
    }
    try {
        for (const evt of events) {
            if (DEBUG_EVENTS) {
                const keys = evt && typeof evt === "object" ? Object.keys(evt) : [];
                console.log("[webhook] event keys:", keys.slice(0, 20));
            }
            const parsed = parseHeliusEvent(evt, tracked);
            if (DEBUG_EVENTS) {
                console.log(`[webhook] parsed transfers: ${parsed.length}`);
                if (parsed.length > 0) {
                    const peek = parsed.slice(0, 2).map(p => ({
                        walletAddress: p.walletAddress,
                        tokenAddress: p.tokenAddress,
                        amount: p.amount,
                        side: p.side,
                        signature: p.signature,
                    }));
                    console.log("[webhook] parsed sample:", peek);
                }
            }
            if (parsed.length === 0)
                continue;
            let wrote = 0;
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
                    wrote++;
                }
                catch (e) {
                    const code = e?.code || e?.name || "unknown";
                    const message = e?.message;
                    // P2002 => Unique constraint failed (duplicate). Safe to ignore for idempotency.
                    if (code === "P2002") {
                        if (DEBUG_EVENTS_VERBOSE) {
                            console.log("[db] duplicate, skipping", {
                                walletAddress: p.walletAddress,
                                tokenAddress: p.tokenAddress,
                                signature: p.signature,
                            });
                        }
                        continue;
                    }
                    console.error("[db] create failed", {
                        walletAddress: p.walletAddress,
                        tokenAddress: p.tokenAddress,
                        signature: p.signature,
                        error: code,
                        message,
                    });
                }
            }
            if (DEBUG_EVENTS)
                console.log(`[webhook] upserts succeeded: ${wrote}/${parsed.length}`);
        }
        if (DEBUG_EVENTS && (!events || events.length === 0)) {
            console.log("[webhook] received empty events array");
        }
        // Ack quickly on success
        res.status(200).json({ ok: true });
    }
    catch (e) {
        console.error("Error handling webhook:", e);
        // Return 500 so Helius will retry delivery
        res.status(500).json({ ok: false });
    }
});
// Gracefully handle body parsing errors and aborted requests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function bodyParseErrorHandler(err, _req, res, next) {
    if (!err)
        return next();
    const msg = (err && (err.message || "")).toLowerCase();
    const type = (err && (err.type || "")).toLowerCase();
    if (msg.includes("request aborted") ||
        type.includes("aborted") ||
        type.includes("entity.too.large") ||
        err instanceof SyntaxError) {
        return res.status(400).json({ error: "invalid request body" });
    }
    return next(err);
});
app.listen(PORT, () => {
    console.log(`Server listening on :${PORT}`);
});
