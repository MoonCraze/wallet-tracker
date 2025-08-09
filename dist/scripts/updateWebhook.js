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
    if (WEBHOOK_ID) {
        // Update existing webhook
        const url = `https://api.helius.xyz/v0/webhooks/${WEBHOOK_ID}?api-key=${API_KEY}`;
        const { data } = await axios.put(url, {
            webhookURL: WEBHOOK_URL,
            transactionTypes: ["ANY"],
            accountAddresses: wallets,
            webhookType: "enhanced", // or "raw" if you prefer lower-latency raw payloads
            authHeader: `X-Helius-Secret: ${WEBHOOK_SECRET}`,
        });
        console.log("Updated webhook:", data.id || data);
    }
    else {
        // Create a new webhook
        const { data } = await axios.post(base, {
            webhookURL: WEBHOOK_URL,
            transactionTypes: ["ANY"],
            accountAddresses: wallets,
            webhookType: "enhanced",
            authHeader: `X-Helius-Secret: ${WEBHOOK_SECRET}`,
        });
        console.log("Created webhook:", data.id || data);
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
