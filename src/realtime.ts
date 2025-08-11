import type { Express, Response, Request } from "express";
import type { Server as HttpServer } from "node:http";
import { getConfig } from "./config.js";

export type TransferBroadcast = {
  walletAddress: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  timestamp: string; // ISO string
  side: "BUY" | "SELL";
};

export type CoordinatedBroadcast = {
  tokenAddress: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  triggeredAt: string; // ISO
  uniqueWalletCount: number;
  walletAddresses: string[]; // parsed array, not stringified
};

// In-memory subscriber lists for SSE
const transfersClients = new Set<Response>();
const coordinatedClients = new Set<Response>();
const allClients = new Set<Response>();

// Keep-alive timers per response to prevent proxies from closing the stream
const heartbeats = new WeakMap<Response, NodeJS.Timeout>();

function setupSse(res: Response, origin?: string) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  // Apply same CORS logic as main API
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins === '*' || !allowedOrigins) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else if (allowedOrigins && origin) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    if (origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cache-Control");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  (res as any).flushHeaders?.();
  res.write(": connected\n\n");
  const t = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      // ignore
    }
  }, 15000);
  heartbeats.set(res, t);
}

function teardownSse(res: Response) {
  const t = heartbeats.get(res);
  if (t) clearInterval(t);
  heartbeats.delete(res);
  try { res.end(); } catch {}
}

export function initRealtime(app: Express, _server?: HttpServer) {
  app.get("/stream/transfers", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    transfersClients.add(res);
    req.on("close", () => {
      transfersClients.delete(res);
      teardownSse(res);
    });
  });

  app.get("/stream/coordinated", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    coordinatedClients.add(res);
    req.on("close", () => {
      coordinatedClients.delete(res);
      teardownSse(res);
    });
  });

  // Combined stream: includes named events for routing client-side
  app.get("/stream/all", (req: Request, res: Response) => {
    const origin = req.headers.origin as string;
    setupSse(res, origin);
    allClients.add(res);
    req.on("close", () => {
      allClients.delete(res);
      teardownSse(res);
    });
  });
}

function safeWrite(res: Response, chunk: string) {
  try {
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

export function publishTransfers(rows: TransferBroadcast[]) {
  if (rows.length === 0) return;
  // De-duplicate rows based on runtime config (signature-only or wallet|token|signature)
  const { dedupBySignatureOnly } = getConfig();
  const unique: TransferBroadcast[] = [];
  for (const r of rows) {
    const key = dedupBySignatureOnly
      ? r.signature
      : `${r.walletAddress}|${r.tokenAddress}|${r.signature}`;
    if (markSeen(seenTransfers, key)) unique.push(r);
  }
  if (unique.length === 0) return;
  // Note: we also keep a client-side dedupe in the demo HTML to avoid re-render on reconnects
  const data = JSON.stringify(unique);
  // Dedicated stream
  for (const res of Array.from(transfersClients)) {
    const ok = safeWrite(res, `data: ${data}\n\n`);
    if (!ok) transfersClients.delete(res);
  }
  // Combined stream with named event
  for (const res of Array.from(allClients)) {
    const ok = safeWrite(res, `event: transfers\n` + `data: ${data}\n\n`);
    if (!ok) allClients.delete(res);
  }
}

export function publishCoordinated(row: CoordinatedBroadcast) {
  // Dedup coordinated by token|windowStart
  const key = `${row.tokenAddress}|${row.windowStart}`;
  if (!markSeen(seenCoordinated, key)) return;
  const data = JSON.stringify(row);
  for (const res of Array.from(coordinatedClients)) {
    const ok = safeWrite(res, `data: ${data}\n\n`);
    if (!ok) coordinatedClients.delete(res);
  }
  for (const res of Array.from(allClients)) {
    const ok = safeWrite(res, `event: coordinated\n` + `data: ${data}\n\n`);
    if (!ok) allClients.delete(res);
  }
}

// Simple in-memory LRU-ish de-dupe with bounded size
const MAX_SEEN = 50_000;
const seenTransfers = makeSeen();
const seenCoordinated = makeSeen();

function makeSeen() {
  return {
    set: new Set<string>(),
    order: [] as string[],
  };
}

function markSeen(store: { set: Set<string>; order: string[] }, key: string): boolean {
  if (store.set.has(key)) return false;
  store.set.add(key);
  store.order.push(key);
  if (store.order.length > MAX_SEEN) {
    const old = store.order.splice(0, store.order.length - MAX_SEEN);
    for (const k of old) store.set.delete(k);
  }
  return true;
}
