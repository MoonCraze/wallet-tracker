import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { prisma } from "./db.js";
import { initRealtime, publishCoordinated, publishTransfers } from "./realtime.js";
import { getConfig, setConfig, configToJSON } from "./config.js";
import { parseHeliusEvent } from "./utils/parse.js";
import { verifyHeliusSecret } from "./verify.js";
const app = express();
// CORS configuration for cross-origin requests
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : '*', // Allow all origins if ALLOWED_ORIGINS is not set
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-helius-secret'],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));
// Serve static files (e.g., test page) from ./public
app.use(express.static("public"));
// Create HTTP server and initialize realtime (SSE + WS)
const server = createServer(app);
initRealtime(app, server);
const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.WEBHOOK_SECRET || "super-secret";
// Convenience getters for dynamic config
const DEBUG_EVENTS = () => getConfig().debugEvents;
const DEBUG_EVENTS_VERBOSE = () => getConfig().debugEventsVerbose;
const MIN_AMOUNT = () => getConfig().minAmount;
const EXCLUDE_TOKENS = () => getConfig().excludeTokensSet;
const DEDUP_BY_SIGNATURE_ONLY = () => getConfig().dedupBySignatureOnly;
const COORDINATED_WINDOW_MINUTES = () => getConfig().coordinatedWindowMinutes;
const COORDINATED_MIN_WALLETS = () => getConfig().coordinatedMinWallets;
const WINDOW_MS = () => Math.max(1, COORDINATED_WINDOW_MINUTES()) * 60_000;
const ALLOW_DEV_ENDPOINTS = process.env.ALLOW_DEV_ENDPOINTS === "1" || process.env.ALLOW_DEV_ENDPOINTS === "true";
// Load wallets.json without using JSON import assertions (compatible with TS/Node ESM)
const wallets = JSON.parse(readFileSync(new URL("./wallets.json", import.meta.url), "utf-8"));
// Build a Set for quick membership checks
const tracked = new Set(wallets);
function floorToWindowStart(d) {
    const t = d.getTime();
    const w = WINDOW_MS();
    return new Date(Math.floor(t / w) * w);
}
// Serve static files
app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true }));
// Config endpoints: GET current config, PATCH to update at runtime
app.get("/config", (_req, res) => {
    res.json(configToJSON(getConfig()));
});
app.patch("/config", express.json(), (req, res) => {
    try {
        const updated = setConfig(req.body || {});
        res.json(configToJSON(updated));
    }
    catch (e) {
        res.status(400).json({ error: e?.message || "invalid config" });
    }
});
// Optional dev endpoints to manually emit realtime messages (disabled by default)
if (ALLOW_DEV_ENDPOINTS) {
    app.get("/dev/ping", (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));
    app.post("/dev/transfers", express.json(), (req, res) => {
        const now = new Date();
        const sample = [
            {
                walletAddress: "DevWal1et1111111111111111111111111111111",
                tokenAddress: "DevToken11111111111111111111111111111111",
                amount: "1.23",
                signature: "DEVSIG-" + Math.random().toString(16).slice(2, 10),
                timestamp: now.toISOString(),
                side: (Math.random() > 0.5 ? "BUY" : "SELL"),
            },
        ];
        try {
            publishTransfers(Array.isArray(req.body) && req.body.length ? req.body : sample);
        }
        catch { }
        res.json({ ok: true, sent: (Array.isArray(req.body) && req.body.length ? req.body.length : sample.length) });
    });
    app.post("/dev/coordinated", express.json(), (req, res) => {
        const now = new Date();
        const win = 5 * 60_000;
        const start = new Date(now.getTime() - win);
        const sample = {
            tokenAddress: "DevTokenCoord11111111111111111111111111111",
            windowStart: start.toISOString(),
            windowEnd: now.toISOString(),
            triggeredAt: now.toISOString(),
            uniqueWalletCount: 7,
            walletAddresses: Array.from({ length: 7 }, (_, i) => `DevWal${i.toString().padStart(2, '0')}et111111111111111111111111`),
        };
        try {
            publishCoordinated((req.body && Object.keys(req.body).length) ? req.body : sample);
        }
        catch { }
        res.json({ ok: true });
    });
    // Simple database viewer endpoints
    app.get("/dev/db/transfers", async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = (page - 1) * limit;
            const transfers = await prisma.transferEvent.findMany({
                take: limit,
                skip: offset,
                orderBy: { timestamp: 'desc' }
            });
            const total = await prisma.transferEvent.count();
            res.json({
                transfers,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        }
        catch (e) {
            res.status(500).json({ error: e?.message || "database error" });
        }
    });
    app.get("/dev/db/coordinated", async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = (page - 1) * limit;
            const coordinated = await prisma.coordinatedTrade.findMany({
                take: limit,
                skip: offset,
                orderBy: { triggeredAt: 'desc' }
            });
            const total = await prisma.coordinatedTrade.count();
            res.json({
                coordinated,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        }
        catch (e) {
            res.status(500).json({ error: e?.message || "database error" });
        }
    });
    app.get("/dev/db/stats", async (req, res) => {
        try {
            const transferCount = await prisma.transferEvent.count();
            const coordinatedCount = await prisma.coordinatedTrade.count();
            const buyCount = await prisma.transferEvent.count({ where: { side: 'BUY' } });
            const sellCount = await prisma.transferEvent.count({ where: { side: 'SELL' } });
            const recentTransfers = await prisma.transferEvent.findMany({
                take: 5,
                orderBy: { timestamp: 'desc' },
                select: { timestamp: true, walletAddress: true, tokenAddress: true, amount: true, side: true }
            });
            res.json({
                stats: {
                    totalTransfers: transferCount,
                    totalCoordinated: coordinatedCount,
                    totalBuys: buyCount,
                    totalSells: sellCount
                },
                recentTransfers
            });
        }
        catch (e) {
            res.status(500).json({ error: e?.message || "database error" });
        }
    });
}
// Surface DB path and CWD up front to catch env/path mismatches
if (DEBUG_EVENTS()) {
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
    if (DEBUG_EVENTS()) {
        console.log(`[webhook] ${recvAt} request received`);
    }
    // Verify request
    const authorized = verifyHeliusSecret(req, SECRET);
    if (!authorized) {
        if (DEBUG_EVENTS()) {
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
    if (DEBUG_EVENTS()) {
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
        // Collect tokens touched by BUYs to re-check coordination after inserts
        const touchedTokens = new Set();
        for (const evt of events) {
            if (DEBUG_EVENTS()) {
                const keys = evt && typeof evt === "object" ? Object.keys(evt) : [];
                console.log("[webhook] event keys:", keys.slice(0, 20));
            }
            const parsed = parseHeliusEvent(evt, tracked);
            const filtered = parsed.filter((p) => {
                if (EXCLUDE_TOKENS().has(p.tokenAddress)) {
                    if (DEBUG_EVENTS_VERBOSE())
                        console.log("[filter] exclude token", { tokenAddress: p.tokenAddress, signature: p.signature });
                    return false;
                }
                const amt = Math.abs(Number(p.amount));
                if (!Number.isFinite(amt) || amt < MIN_AMOUNT()) {
                    if (DEBUG_EVENTS_VERBOSE())
                        console.log("[filter] below min amount", { amount: p.amount, min: MIN_AMOUNT(), signature: p.signature });
                    return false;
                }
                return true;
            });
            if (DEBUG_EVENTS() && parsed.length > 0) {
                const peek = filtered.slice(0, 2).map(p => ({ walletAddress: p.walletAddress, tokenAddress: p.tokenAddress, amount: p.amount, side: p.side, signature: p.signature }));
                console.log("[webhook] parsed sample:", peek);
                const dropped = parsed.length - filtered.length;
                if (dropped > 0)
                    console.log(`[webhook] filtered out: ${dropped}`);
            }
            if (filtered.length === 0)
                continue;
            // Deduplicate within this payload
            const uniqMap = new Map();
            for (const p of filtered) {
                const key = DEDUP_BY_SIGNATURE_ONLY() ? p.signature : `${p.walletAddress}|${p.tokenAddress}|${p.signature}`;
                if (!uniqMap.has(key))
                    uniqMap.set(key, p);
            }
            const toWrite = Array.from(uniqMap.values());
            // Check existing keys in DB to avoid duplicate inserts & broadcasts
            let existingKeys = new Set();
            try {
                if (toWrite.length > 0) {
                    if (DEDUP_BY_SIGNATURE_ONLY()) {
                        const sigs = Array.from(new Set(toWrite.map(p => p.signature)));
                        const rows = await prisma.transferEvent.findMany({ where: { signature: { in: sigs } }, select: { signature: true } });
                        existingKeys = new Set(rows.map(r => r.signature));
                    }
                    else {
                        // Optimize by querying only by signature and filtering client-side
                        const sigs = Array.from(new Set(toWrite.map(p => p.signature)));
                        const rows = await prisma.transferEvent.findMany({
                            where: { signature: { in: sigs } },
                            select: { walletAddress: true, tokenAddress: true, signature: true },
                        });
                        existingKeys = new Set(rows.map(r => `${r.walletAddress}|${r.tokenAddress}|${r.signature}`));
                    }
                }
            }
            catch (e) {
                if (DEBUG_EVENTS())
                    console.warn("[db] existing keys check failed", e);
            }
            const newRows = toWrite.filter(p => {
                const k = DEDUP_BY_SIGNATURE_ONLY() ? p.signature : `${p.walletAddress}|${p.tokenAddress}|${p.signature}`;
                return !existingKeys.has(k);
            });
            let created = 0;
            if (newRows.length > 0) {
                try {
                    const resCM = await prisma.transferEvent.createMany({
                        data: newRows.map(p => ({
                            walletAddress: p.walletAddress,
                            tokenAddress: p.tokenAddress,
                            amount: p.amount,
                            signature: p.signature,
                            timestamp: new Date(p.timestamp),
                            side: p.side,
                        })),
                    });
                    created = resCM?.count ?? newRows.length;
                }
                catch (e) {
                    // Fallback to upsert if createMany is unsupported
                    for (const p of newRows) {
                        try {
                            await prisma.transferEvent.upsert({
                                where: { wallet_token_sig_unique: { walletAddress: p.walletAddress, tokenAddress: p.tokenAddress, signature: p.signature } },
                                update: {},
                                create: { walletAddress: p.walletAddress, tokenAddress: p.tokenAddress, amount: p.amount, signature: p.signature, timestamp: new Date(p.timestamp), side: p.side },
                            });
                            created++;
                        }
                        catch { }
                    }
                }
            }
            if (DEBUG_EVENTS())
                console.log(`[webhook] inserted: ${created}/${toWrite.length} (skipped existing: ${toWrite.length - created})`);
            // Broadcast only newly created rows
            if (newRows.length > 0) {
                const broadcastRows = newRows.map(p => ({
                    walletAddress: p.walletAddress,
                    tokenAddress: p.tokenAddress,
                    amount: p.amount,
                    signature: p.signature,
                    timestamp: new Date(p.timestamp).toISOString(),
                    side: p.side,
                }));
                try {
                    publishTransfers(broadcastRows);
                }
                catch (e) {
                    if (DEBUG_EVENTS())
                        console.warn("[sse] transfer broadcast failed", e);
                }
            }
            for (const p of newRows)
                if (p.side === "BUY")
                    touchedTokens.add(p.tokenAddress);
        }
        if (DEBUG_EVENTS() && (!events || events.length === 0)) {
            console.log("[webhook] received empty events array");
        }
        // Check coordinated buys per touched token
        const now = new Date();
        const start = new Date(now.getTime() - WINDOW_MS());
        const windowStart = floorToWindowStart(now);
        const windowEnd = new Date(windowStart.getTime() + WINDOW_MS());
        for (const tokenAddress of touchedTokens) {
            const rows = await prisma.transferEvent.findMany({ where: { tokenAddress, side: "BUY", timestamp: { gte: start, lt: now } }, select: { walletAddress: true } });
            const uniq = Array.from(new Set(rows.map(r => r.walletAddress))).sort();
            if (uniq.length >= COORDINATED_MIN_WALLETS()) {
                try {
                    const existing = await prisma.coordinatedTrade.findFirst({ where: { tokenAddress, windowStart }, select: { id: true } });
                    if (existing) {
                        const updated = await prisma.coordinatedTrade.update({
                            where: { id: existing.id },
                            data: { uniqueWalletCount: uniq.length, walletAddresses: JSON.stringify(uniq), windowEnd, triggeredAt: now },
                        });
                        try {
                            publishCoordinated({ tokenAddress, windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(), triggeredAt: now.toISOString(), uniqueWalletCount: updated.uniqueWalletCount, walletAddresses: JSON.parse(updated.walletAddresses || "[]") });
                        }
                        catch (e) {
                            if (DEBUG_EVENTS())
                                console.warn("[sse] coordinated broadcast failed", e);
                        }
                    }
                    else {
                        const created = await prisma.coordinatedTrade.create({ data: { tokenAddress, windowStart, windowEnd, triggeredAt: now, uniqueWalletCount: uniq.length, walletAddresses: JSON.stringify(uniq) } });
                        try {
                            publishCoordinated({ tokenAddress, windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString(), triggeredAt: now.toISOString(), uniqueWalletCount: created.uniqueWalletCount, walletAddresses: JSON.parse(created.walletAddresses || "[]") });
                        }
                        catch (e) {
                            if (DEBUG_EVENTS())
                                console.warn("[sse] coordinated broadcast failed", e);
                        }
                    }
                    if (DEBUG_EVENTS())
                        console.log("[coord] detected coordinated BUY:", { token: tokenAddress, windowStart: windowStart.toISOString(), count: uniq.length });
                }
                catch (e) {
                    if (DEBUG_EVENTS())
                        console.warn("[coord] upsert failed", e);
                }
            }
        }
        res.status(200).json({ ok: true });
    }
    catch (e) {
        console.error("Error handling webhook:", e);
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
server.listen(PORT, () => {
    console.log(`Server listening on :${PORT}`);
    console.log("[config]", {
        DATABASE_URL: process.env.DATABASE_URL,
        PORT,
        EXCLUDE_TOKENS: Array.from(EXCLUDE_TOKENS()),
        MIN_AMOUNT: MIN_AMOUNT(),
        DEDUP_BY_SIGNATURE_ONLY: DEDUP_BY_SIGNATURE_ONLY(),
        COORDINATED_WINDOW_MINUTES: COORDINATED_WINDOW_MINUTES(),
        COORDINATED_MIN_WALLETS: COORDINATED_MIN_WALLETS(),
        DEBUG_EVENTS: DEBUG_EVENTS(),
        DEBUG_EVENTS_VERBOSE: DEBUG_EVENTS_VERBOSE(),
    });
    // Background scanner: periodically scan the last window for coordinated buys (adapts to config)
    const scan = async () => {
        try {
            const now = new Date();
            const start = new Date(now.getTime() - WINDOW_MS());
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
                if (uniq.length >= COORDINATED_MIN_WALLETS()) {
                    const windowStart = floorToWindowStart(start);
                    const windowEnd = new Date(windowStart.getTime() + WINDOW_MS());
                    const existing = await prisma.coordinatedTrade.findFirst({
                        where: { tokenAddress: token, windowStart },
                        select: { id: true },
                    });
                    if (existing) {
                        const updated = await prisma.coordinatedTrade.update({
                            where: { id: existing.id },
                            data: {
                                uniqueWalletCount: uniq.length,
                                walletAddresses: JSON.stringify(uniq),
                                windowEnd,
                                triggeredAt: now,
                            },
                        });
                        try {
                            publishCoordinated({
                                tokenAddress: token,
                                windowStart: windowStart.toISOString(),
                                windowEnd: windowEnd.toISOString(),
                                triggeredAt: now.toISOString(),
                                uniqueWalletCount: updated.uniqueWalletCount,
                                walletAddresses: JSON.parse(updated.walletAddresses || "[]"),
                            });
                        }
                        catch (e) {
                            if (DEBUG_EVENTS())
                                console.warn("[sse] coordinated broadcast failed", e);
                        }
                    }
                    else {
                        const created = await prisma.coordinatedTrade.create({
                            data: {
                                tokenAddress: token,
                                windowStart,
                                windowEnd,
                                triggeredAt: now,
                                uniqueWalletCount: uniq.length,
                                walletAddresses: JSON.stringify(uniq),
                            },
                        });
                        try {
                            publishCoordinated({
                                tokenAddress: token,
                                windowStart: windowStart.toISOString(),
                                windowEnd: windowEnd.toISOString(),
                                triggeredAt: now.toISOString(),
                                uniqueWalletCount: created.uniqueWalletCount,
                                walletAddresses: JSON.parse(created.walletAddresses || "[]"),
                            });
                        }
                        catch (e) {
                            if (DEBUG_EVENTS())
                                console.warn("[sse] coordinated broadcast failed", e);
                        }
                    }
                    if (DEBUG_EVENTS()) {
                        console.log("[coord/bg] coordinated BUY:", {
                            token,
                            windowStart: windowStart.toISOString(),
                            count: uniq.length,
                        });
                    }
                }
            }
        }
        catch (e) {
            if (DEBUG_EVENTS())
                console.warn("[coord/bg] scan failed", e);
        }
        // schedule next run based on current window config
        const intervalMs = Math.min(60_000, Math.max(10_000, Math.floor(WINDOW_MS() / 2)));
        setTimeout(scan, intervalMs);
    };
    // Kick off first scan
    scan();
});
