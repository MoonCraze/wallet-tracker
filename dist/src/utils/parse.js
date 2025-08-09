import { z } from "zod";
// WSOL mint constant used to represent native SOL in a token-like way
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
// Minimal schema for Helius enhanced webhook payloads we care about
const heliusSchema = z.object({
    type: z.string().optional(),
    signature: z.string(),
    timestamp: z.number().or(z.string()).optional(),
    // Enhanced payloads often include tokenTransfers[]
    tokenTransfers: z
        .array(z.object({
        fromUserAccount: z.string().optional(),
        toUserAccount: z.string().optional(),
        mint: z.string().optional(),
        tokenAmount: z.number().or(z.string()).optional(),
        // for SOL transfers, mint may be undefined; we'll handle via native transfers
    }))
        .optional(),
    // Native SOL transfers show up in nativeTransfers[]
    nativeTransfers: z
        .array(z.object({
        fromUserAccount: z.string().optional(),
        toUserAccount: z.string().optional(),
        amount: z.number().or(z.string()).optional() // in lamports
    }))
        .optional(),
});
// Convert lamports to SOL string
function lamportsToSolStr(v) {
    if (v === undefined)
        return "0";
    const n = typeof v === "string" ? Number(v) : v;
    return (n / 1_000_000_000).toString();
}
export function parseHeliusEvent(body, tracked) {
    const results = [];
    const payload = heliusSchema.safeParse(body);
    if (!payload.success)
        return results;
    const evt = payload.data;
    const signature = evt.signature;
    const ts = evt.timestamp
        ? new Date(Number(evt.timestamp) * (Number(evt.timestamp) > 1e12 ? 1 : 1000))
        : new Date();
    // SPL token transfers
    if (evt.tokenTransfers) {
        for (const t of evt.tokenTransfers) {
            const { fromUserAccount, toUserAccount, mint, tokenAmount } = t;
            if (!mint || tokenAmount === undefined)
                continue;
            const amount = typeof tokenAmount === "string" ? tokenAmount : tokenAmount.toString();
            // Is this transfer relevant to any tracked wallet?
            const fromTracked = fromUserAccount && tracked.has(fromUserAccount);
            const toTracked = toUserAccount && tracked.has(toUserAccount);
            if (!fromTracked && !toTracked)
                continue;
            const walletAddress = (toTracked ? toUserAccount : fromUserAccount);
            const side = toTracked ? "BUY" : "SELL";
            results.push({
                walletAddress,
                tokenAddress: mint,
                amount,
                signature,
                timestamp: ts.toISOString(),
                side,
            });
        }
    }
    // Native SOL transfers (map to WSOL_MINT)
    if (evt.nativeTransfers) {
        for (const t of evt.nativeTransfers) {
            const { fromUserAccount, toUserAccount, amount } = t;
            const fromTracked = fromUserAccount && tracked.has(fromUserAccount);
            const toTracked = toUserAccount && tracked.has(toUserAccount);
            if (!fromTracked && !toTracked)
                continue;
            const walletAddress = (toTracked ? toUserAccount : fromUserAccount);
            const side = toTracked ? "BUY" : "SELL";
            results.push({
                walletAddress,
                tokenAddress: WSOL_MINT,
                amount: lamportsToSolStr(amount),
                signature,
                timestamp: ts.toISOString(),
                side,
            });
        }
    }
    return results;
}
