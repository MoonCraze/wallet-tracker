import { z } from "zod";
import type { ParsedTransfer } from "../types";

// WSOL mint constant used to represent native SOL in a token-like way
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Minimal schema for Helius enhanced webhook payloads we care about
const heliusSchema = z.object({
  type: z.string().optional(),
  signature: z.string(),
  timestamp: z.number().or(z.string()).optional(),
  // Enhanced payloads often include tokenTransfers[]
  tokenTransfers: z
    .array(
      z.object({
        // Owner wallets (preferred when present)
        fromUserAccount: z.string().optional(),
        toUserAccount: z.string().optional(),
        // Sometimes token account owners may appear under these alt keys
        fromUserAccountOwner: z.string().optional(),
        toUserAccountOwner: z.string().optional(),
        // Token accounts (ATA) — we DON'T match these against tracked wallets, but keep for context
        fromTokenAccount: z.string().optional(),
        toTokenAccount: z.string().optional(),
        mint: z.string().optional(),
        tokenAmount: z.number().or(z.string()).optional(),
        amount: z.number().or(z.string()).optional(),
        rawTokenAmount: z
          .object({ tokenAmount: z.string(), decimals: z.number().optional() })
          .optional(),
        // for SOL transfers, mint may be undefined; we'll handle via native transfers
      })
    )
    .optional(),
  // Native SOL transfers show up in nativeTransfers[]
  nativeTransfers: z
    .array(
      z.object({
        fromUserAccount: z.string().optional(),
        toUserAccount: z.string().optional(),
        // some payloads might use generic keys
        from: z.string().optional(),
        to: z.string().optional(),
        amount: z.number().or(z.string()).optional() // in lamports
      })
    )
    .optional(),
});

// Convert lamports to SOL string
function lamportsToSolStr(v: number | string | undefined): string {
  if (v === undefined) return "0";
  const n = typeof v === "string" ? Number(v) : v;
  return (n / 1_000_000_000).toString();
}

// Convert a raw integer amount and decimals into a decimal string
function toDecimalString(amountStr: string, decimals = 0): string {
  // handle big values as strings safely
  const negative = amountStr.startsWith("-");
  const digits = negative ? amountStr.slice(1) : amountStr;
  const padded = digits.padStart(decimals + 1, "0");
  const head = padded.slice(0, padded.length - decimals);
  const tail = decimals > 0 ? padded.slice(-decimals) : "";
  const val = decimals > 0 ? `${head}.${tail}` : head;
  return negative ? `-${val}` : val;
}

function pickOwnerAddr(t: any, side: "from" | "to"): string | undefined {
  // Prefer explicit owner wallet keys if present
  const a = side === "from" ? [
    t.fromUserAccount,
    t.fromUserAccountOwner,
    t.fromUser,
  ] : [
    t.toUserAccount,
    t.toUserAccountOwner,
    t.toUser,
  ];
  for (const v of a) if (typeof v === "string" && v.length > 0) return v;
  return undefined;
}

export function parseHeliusEvent(
  body: unknown,
  tracked: Set<string>
): ParsedTransfer[] {
  const results: ParsedTransfer[] = [];

  // Unwrap common wrapper shapes before schema validation
  const unwrap = (b: any): any => {
    if (!b || typeof b !== "object") return b;
    // If the payload contains an array of transactions, flatten them
    if (Array.isArray(b.transactions)) {
      for (const tx of b.transactions) {
        const inner = unwrap(tx);
        results.push(...parseHeliusEvent(inner, tracked));
      }
      return { __alreadyHandled: true };
    }
    // If the payload nests fields under `events`, lift them
    if (b.events && typeof b.events === "object") {
      const lifted: any = { ...b.events };
      // propagate signature/timestamp if present outside
      if (b.signature) lifted.signature = b.signature;
      if (b.timestamp || b.blockTime) lifted.timestamp = b.timestamp ?? b.blockTime;
      // Some shapes use `signatures: string[]`
      if (!lifted.signature && Array.isArray(b.signatures) && b.signatures[0]) {
        lifted.signature = b.signatures[0];
      }
      // Or `transaction.signatures`
      if (!lifted.signature && Array.isArray(b.transaction?.signatures) && b.transaction.signatures[0]) {
        lifted.signature = b.transaction.signatures[0];
      }
      return lifted;
    }
    return b;
  };

  const unwrapped = unwrap(body as any);
  if ((unwrapped as any)?.__alreadyHandled) return results; // already processed above

  const payload = heliusSchema.safeParse(unwrapped);
  if (!payload.success) return results;
  const evt = payload.data;

  const signature =
    evt.signature ??
    // try a few common alternate locations just in case
    (unwrapped as any)?.signatures?.[0] ??
    (unwrapped as any)?.transaction?.signatures?.[0] ??
    (unwrapped as any)?.hash ??
    (unwrapped as any)?.id ??
    "";
  const ts = evt.timestamp
    ? new Date(Number(evt.timestamp) * (Number(evt.timestamp) > 1e12 ? 1 : 1000))
    : new Date();

  // SPL token transfers
  if (evt.tokenTransfers) {
    for (const t of evt.tokenTransfers) {
      const { mint } = t;
      if (!mint) continue;
      // Amount can be in tokenAmount, amount, or rawTokenAmount
      let amount: string | undefined = undefined;
      if (t.tokenAmount !== undefined) {
        amount = typeof t.tokenAmount === "string" ? t.tokenAmount : t.tokenAmount.toString();
      } else if (t.amount !== undefined) {
        amount = typeof t.amount === "string" ? t.amount : t.amount.toString();
      } else if (t.rawTokenAmount?.tokenAmount !== undefined) {
        amount = toDecimalString(t.rawTokenAmount.tokenAmount, t.rawTokenAmount.decimals ?? 0);
      }
      if (amount === undefined) continue;

      // Is this transfer relevant to any tracked wallet?
      const fromAddr = pickOwnerAddr(t, "from");
      const toAddr = pickOwnerAddr(t, "to");
      const fromTracked = fromAddr && tracked.has(fromAddr);
      const toTracked = toAddr && tracked.has(toAddr);
      if (!fromTracked && !toTracked) {
        if (process.env.DEBUG_EVENTS === "1" || process.env.DEBUG_EVENTS === "true") {
          console.log("[debug] skip tokenTransfer: not tracked", {
            fromUserAccount: fromAddr,
            toUserAccount: toAddr,
            mint,
          });
        }
        continue;
      }

      const walletAddress = (toTracked ? toAddr : fromAddr)!;
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
  const fromAddr = t.fromUserAccount || t.from;
  const toAddr = t.toUserAccount || t.to;
  const amount = t.amount;
  const fromTracked = fromAddr && tracked.has(fromAddr);
  const toTracked = toAddr && tracked.has(toAddr);
      if (!fromTracked && !toTracked) {
        if (process.env.DEBUG_EVENTS === "1" || process.env.DEBUG_EVENTS === "true") {
          console.log("[debug] skip nativeTransfer: not tracked", {
    fromUserAccount: fromAddr,
    toUserAccount: toAddr,
          });
        }
        continue;
      }
  const walletAddress = (toTracked ? toAddr : fromAddr)!;
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