// In-memory subscriber lists for SSE
const transfersClients = new Set();
const coordinatedClients = new Set();
const allClients = new Set();
// Keep-alive timers per response to prevent proxies from closing the stream
const heartbeats = new WeakMap();
function setupSse(res, origin) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Apply same CORS logic as main API
    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (allowedOrigins === '*' || !allowedOrigins) {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    else if (allowedOrigins && origin) {
        const origins = allowedOrigins.split(',').map(o => o.trim());
        if (origins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        }
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cache-Control");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.flushHeaders?.();
    res.write(": connected\n\n");
    const t = setInterval(() => {
        try {
            res.write(": keepalive\n\n");
        }
        catch {
            // ignore
        }
    }, 15000);
    heartbeats.set(res, t);
}
function teardownSse(res) {
    const t = heartbeats.get(res);
    if (t)
        clearInterval(t);
    heartbeats.delete(res);
    try {
        res.end();
    }
    catch { }
}
export function initRealtime(app, _server) {
    app.get("/stream/transfers", (req, res) => {
        const origin = req.headers.origin;
        setupSse(res, origin);
        transfersClients.add(res);
        req.on("close", () => {
            transfersClients.delete(res);
            teardownSse(res);
        });
    });
    app.get("/stream/coordinated", (req, res) => {
        const origin = req.headers.origin;
        setupSse(res, origin);
        coordinatedClients.add(res);
        req.on("close", () => {
            coordinatedClients.delete(res);
            teardownSse(res);
        });
    });
    // Combined stream: includes named events for routing client-side
    app.get("/stream/all", (req, res) => {
        const origin = req.headers.origin;
        setupSse(res, origin);
        allClients.add(res);
        req.on("close", () => {
            allClients.delete(res);
            teardownSse(res);
        });
    });
}
// Helper function to safely write to SSE streams
function safeWrite(res, chunk) {
    try {
        res.write(chunk);
        return true;
    }
    catch {
        return false;
    }
}
export function publishTransfers(rows) {
    if (rows.length === 0)
        return;
    // De-duplicate rows based on signature only for realtime streaming
    const unique = [];
    const seen = new Set();
    for (const row of rows) {
        if (!seen.has(row.signature)) {
            seen.add(row.signature);
            unique.push(row);
        }
    }
    if (unique.length === 0)
        return;
    const data = JSON.stringify(unique);
    // Dedicated transfers stream
    for (const res of Array.from(transfersClients)) {
        const ok = safeWrite(res, `data: ${data}\n\n`);
        if (!ok)
            transfersClients.delete(res);
    }
    // Combined stream with named event
    for (const res of Array.from(allClients)) {
        const ok = safeWrite(res, `event: transfers\n` + `data: ${data}\n\n`);
        if (!ok)
            allClients.delete(res);
    }
}
export function publishCoordinated(row) {
    const data = JSON.stringify(row);
    for (const res of Array.from(coordinatedClients)) {
        const ok = safeWrite(res, `data: ${data}\n\n`);
        if (!ok)
            coordinatedClients.delete(res);
    }
    for (const res of Array.from(allClients)) {
        const ok = safeWrite(res, `event: coordinated\n` + `data: ${data}\n\n`);
        if (!ok)
            allClients.delete(res);
    }
}
