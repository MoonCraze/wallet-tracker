import "dotenv/config";
import axios from "axios";
import { readFileSync } from "node:fs";
const wallets = JSON.parse(readFileSync(new URL("../src/wallets.json", import.meta.url), "utf-8"));
// Accept both correct and legacy-typo env var names
const API_KEY = process.env.HELIUS_API_KEY || process.env.HELlUS_API_KEY;
const WEBHOOK_ID = process.env.WEBHOOK_ID; // if provided, we'll UPDATE; else CREATE
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "super-secret";
if (!API_KEY || !WEBHOOK_URL) {
    console.error("Missing HELIUS_API_KEY (or HELlUS_API_KEY) or WEBHOOK_URL in env");
    process.exit(1);
}
async function main() {
    const base = `https://api.helius.xyz/v0/webhooks?api-key=${API_KEY}`;
    async function listWebhooks() {
        const { data } = await axios.get(base);
        return Array.isArray(data) ? data : [];
    }
    if (WEBHOOK_ID) {
        // Update existing webhook
        const url = `https://api.helius.xyz/v0/webhooks/${WEBHOOK_ID}?api-key=${API_KEY}`;
        const { data } = await axios.put(url, {
            webhookURL: WEBHOOK_URL,
            transactionTypes: ["ANY"],
            accountAddresses: wallets,
            webhookType: "enhanced", // or "raw" if you prefer lower-latency raw payloads
            authHeader: `Authorization: Bearer ${WEBHOOK_SECRET}`,
        });
        console.log("Updated webhook:", data.id || data);
    }
    else {
        // No WEBHOOK_ID provided. Prefer updating an existing webhook matching the same URL.
        const existing = (await listWebhooks()).find(w => w.webhookURL === WEBHOOK_URL);
        if (existing) {
            const existingId = existing.id || existing.webhookID || existing.webhookId;
            if (!existingId) {
                console.warn("Found matching webhook by URL but response had no id/webhookID field. Raw:", existing);
            }
            const url = `https://api.helius.xyz/v0/webhooks/${existingId}?api-key=${API_KEY}`;
            const { data } = await axios.put(url, {
                webhookURL: WEBHOOK_URL,
                transactionTypes: ["ANY"],
                accountAddresses: wallets,
                webhookType: "enhanced",
                authHeader: `Authorization: Bearer ${WEBHOOK_SECRET}`,
            });
            console.log("Updated existing webhook (matched by URL):", data.id || data);
            return;
        }
        // Create a new webhook (fallback when no matching URL is found)
        try {
            const { data } = await axios.post(base, {
                webhookURL: WEBHOOK_URL,
                transactionTypes: ["ANY"],
                accountAddresses: wallets,
                webhookType: "enhanced",
                authHeader: `Authorization: Bearer ${WEBHOOK_SECRET}`,
            });
            console.log("Created webhook:", data.id || data);
        }
        catch (err) {
            // Improve error message for common quota issue
            const msg = err?.response?.data?.error || err?.message;
            if (msg && typeof msg === "string" && msg.toLowerCase().includes("webhook limit")) {
                console.error("Helius API reports you've reached your webhook limit for this API key.");
                console.error("Options: set WEBHOOK_ID in .env to update an existing webhook, delete an old webhook, or upgrade your plan.");
                const all = await listWebhooks();
                if (all.length) {
                    console.error("Existing webhook IDs:");
                    for (const w of all) {
                        console.error(`- ${w.id} (${w.webhookURL})`);
                    }
                }
            }
            throw err;
        }
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
