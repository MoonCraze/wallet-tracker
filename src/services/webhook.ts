import { readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { prisma } from "../db.js";
import { parseHeliusEvent } from "../utils/parse.js";
import { getConfig } from "../config.js";
import { publishTransfers, publishCoordinated } from "../realtime.js";
import { Logger } from "../lib/logger.js";

// Broadcast cache to prevent duplicate SSE events during race conditions
const recentlyBroadcastTransfers = new Map<string, number>();
const recentlyBroadcastCoordinated = new Map<string, number>();
const BROADCAST_CACHE_TTL = 5000; // 5 seconds

// Periodic cleanup of expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlyBroadcastTransfers.entries()) {
    if (now - timestamp > BROADCAST_CACHE_TTL) {
      recentlyBroadcastTransfers.delete(key);
    }
  }
  for (const [key, timestamp] of recentlyBroadcastCoordinated.entries()) {
    if (now - timestamp > BROADCAST_CACHE_TTL) {
      recentlyBroadcastCoordinated.delete(key);
    }
  }
}, 10000);

export class WebhookService {
  private wallets: Set<string>;

  constructor() {
    // Load tracked wallets
    const walletsData: string[] = JSON.parse(
      readFileSync(new URL("../wallets.json", import.meta.url), "utf-8")
    );
    this.wallets = new Set(walletsData);
  }

  private floorToWindowStart(date: Date): Date {
    const config = getConfig();
    const windowMs = Math.max(1, config.coordinatedWindowMinutes) * 60_000;
    const timestamp = date.getTime();
    return new Date(Math.floor(timestamp / windowMs) * windowMs);
  }

  private async logWebhookEvent(events: any[], headers: any): Promise<void> {
    const config = getConfig();
    if (!config.debugEvents) return;

    try {
      const logDir = joinPath(process.cwd(), "logs");
      mkdirSync(logDir, { recursive: true });
      const file = joinPath(logDir, "events.ndjson");
      
      for (const evt of events) {
        const record = {
          receivedAt: new Date().toISOString(),
          headers: {
            contentType: headers["content-type"],
            hasXHeliusSecret: typeof headers["x-helius-secret"] === "string",
          },
          event: evt,
        };
        appendFileSync(file, JSON.stringify(record) + "\n", "utf8");
      }
      
      Logger.debug(`Logged ${events.length} event(s) to logs/events.ndjson`);
    } catch (error) {
      Logger.warn("Failed to write webhook logs", { error });
    }
  }

  private async deduplicateAndFilter(transfers: any[]): Promise<any[]> {
    const config = getConfig();
    
    const filtered = transfers.filter((transfer) => {
      if (config.excludeTokensSet.has(transfer.tokenAddress)) {
        return false;
      }
      const amount = Math.abs(Number(transfer.amount));
      return Number.isFinite(amount) && amount >= config.minAmount;
    });

    // Deduplicate using composite key: wallet + token + signature
    // Note: One transaction can contain multiple token transfers
    const uniqueMap = new Map<string, typeof filtered[number]>();
    for (const transfer of filtered) {
      const key = `${transfer.walletAddress}|${transfer.tokenAddress}|${transfer.signature}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, transfer);
      }
    }

    const deduplicated = Array.from(uniqueMap.values());
    if (deduplicated.length === 0) return [];

    const existingKeys = await this.getExistingTransferKeys(deduplicated);
    
    return deduplicated.filter((transfer) => {
      const key = `${transfer.walletAddress}|${transfer.tokenAddress}|${transfer.signature}`;
      return !existingKeys.has(key);
    });
  }

  private async getExistingTransferKeys(transfers: any[]): Promise<Set<string>> {
    try {
      const signatures = Array.from(new Set(transfers.map(t => t.signature)));
      
      const existing = await prisma.transferEvent.findMany({
        where: { signature: { in: signatures } },
        select: { walletAddress: true, tokenAddress: true, signature: true }
      });
      
      return new Set(existing.map(e => `${e.walletAddress}|${e.tokenAddress}|${e.signature}`));
    } catch (error) {
      Logger.warn("Failed to check existing transfer keys", { error });
      return new Set();
    }
  }

  private async saveTransfers(transfers: any[]): Promise<number> {
    if (transfers.length === 0) return 0;

    try {
      const result = await prisma.transferEvent.createMany({
        data: transfers.map(t => ({
          walletAddress: t.walletAddress,
          tokenAddress: t.tokenAddress,
          amount: t.amount,
          signature: t.signature,
          timestamp: new Date(t.timestamp),
          side: t.side,
        })),
        skipDuplicates: true,
      });
      
      return result.count;
    } catch (error) {
      Logger.warn("CreateMany failed, falling back to upserts", { error });
      
      let created = 0;
      for (const transfer of transfers) {
        try {
          await prisma.transferEvent.upsert({
            where: { 
              wallet_token_sig_unique: { 
                walletAddress: transfer.walletAddress, 
                tokenAddress: transfer.tokenAddress, 
                signature: transfer.signature 
              } 
            },
            update: {},
            create: {
              walletAddress: transfer.walletAddress,
              tokenAddress: transfer.tokenAddress,
              amount: transfer.amount,
              signature: transfer.signature,
              timestamp: new Date(transfer.timestamp),
              side: transfer.side,
            },
          });
          created++;
        } catch (upsertError) {
          Logger.warn("Failed to upsert transfer", { transfer, error: upsertError });
        }
      }
      return created;
    }
  }

  private async checkCoordinatedTrades(touchedTokens: Set<string>): Promise<void> {
    const config = getConfig();
    const now = new Date();
  const currentWindowStart = this.floorToWindowStart(now);
  // Use the CURRENT window bucket so detection triggers within-window
  const windowStart = new Date(currentWindowStart.getTime());
  const windowEnd = new Date(currentWindowStart.getTime() + (config.coordinatedWindowMinutes * 60_000));

    Logger.debug("Checking coordinated trades", {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      touchedTokens: Array.from(touchedTokens)
    });

    for (const tokenAddress of touchedTokens) {
      // Skip excluded tokens for coordination as well
      if (config.excludeTokensSet.has(tokenAddress)) continue;
      await this.processTokenForCoordination(tokenAddress, windowStart, windowEnd, now);
    }
  }

  private async processTokenForCoordination(
    tokenAddress: string, 
    windowStart: Date, 
    windowEnd: Date, 
    triggeredAt: Date
  ): Promise<void> {
    const config = getConfig();
    
    // Check broadcast cache first to prevent redundant processing
    const broadcastKey = `${tokenAddress}|${windowStart.toISOString()}`;
    const now = Date.now();
    const lastBroadcast = recentlyBroadcastCoordinated.get(broadcastKey);
    
    if (lastBroadcast && (now - lastBroadcast) < BROADCAST_CACHE_TTL) {
      Logger.debug("Recently processed in cache", { tokenAddress, windowStart });
      return;
    }
    
    const existing = await prisma.coordinatedTrade.findFirst({
      where: { tokenAddress, windowStart },
      select: { id: true }
    });
    
    if (existing) {
      Logger.debug("Token already processed for window", { tokenAddress, windowStart });
      return;
    }

    const buyers = await prisma.transferEvent.findMany({
      where: { 
        tokenAddress, 
        side: "BUY", 
        timestamp: { gte: windowStart, lt: triggeredAt } 
      },
      select: { walletAddress: true },
      distinct: ["walletAddress"]
    });

    const uniqueWallets = buyers.map(b => b.walletAddress).sort();
    
    if (uniqueWallets.length >= config.coordinatedMinWallets) {
      try {
        // Use upsert to handle race conditions
        const coordinatedTrade = await prisma.coordinatedTrade.upsert({
          where: {
            token_window_unique: {
              tokenAddress,
              windowStart
            }
          },
          update: {},
          create: {
            tokenAddress,
            windowStart,
            windowEnd,
            triggeredAt,
            uniqueWalletCount: uniqueWallets.length,
            walletAddresses: JSON.stringify(uniqueWallets),
          },
        });

        // Set broadcast cache and publish only once
        recentlyBroadcastCoordinated.set(broadcastKey, now);
        
        publishCoordinated({
          tokenAddress,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          triggeredAt: triggeredAt.toISOString(),
          uniqueWalletCount: coordinatedTrade.uniqueWalletCount,
          walletAddresses: uniqueWallets,
        });

        Logger.info("Detected coordinated trade", {
          tokenAddress,
          windowStart: windowStart.toISOString(),
          uniqueWalletCount: uniqueWallets.length
        });
      } catch (error) {
        Logger.debug("Race condition - already created", { tokenAddress, error: (error as any).message });
      }
    }
  }

  async processWebhook(body: any, headers: any): Promise<{ processed: number }> {
    const events = Array.isArray(body) ? body : [body];
    
    await this.logWebhookEvent(events, headers);

    const touchedTokens = new Set<string>();
    let totalProcessed = 0;

    for (const event of events) {
      const parsed = parseHeliusEvent(event, this.wallets);
      const newTransfers = await this.deduplicateAndFilter(parsed);
      
      if (newTransfers.length > 0) {
        const saved = await this.saveTransfers(newTransfers);
        totalProcessed += saved;

        const now = Date.now();
        const toBroadcast = newTransfers.filter(t => {
          const key = `${t.walletAddress}|${t.tokenAddress}|${t.signature}`;
          const lastBroadcast = recentlyBroadcastTransfers.get(key);
          
          if (lastBroadcast && (now - lastBroadcast) < BROADCAST_CACHE_TTL) {
            return false;
          }
          
          recentlyBroadcastTransfers.set(key, now);
          return true;
        });

        if (toBroadcast.length > 0) {
          const broadcastData = toBroadcast.map(t => ({
            walletAddress: t.walletAddress,
            tokenAddress: t.tokenAddress,
            amount: t.amount,
            signature: t.signature,
            timestamp: new Date(t.timestamp).toISOString(),
            side: t.side as "BUY" | "SELL",
          }));
          
          publishTransfers(broadcastData);
          
          if (toBroadcast.length < newTransfers.length) {
            Logger.debug(`Skipped ${newTransfers.length - toBroadcast.length} duplicate broadcasts`);
          }
        }

        // Track tokens with BUY transactions for coordination check
        for (const transfer of newTransfers) {
          if (transfer.side === "BUY") {
            touchedTokens.add(transfer.tokenAddress);
          }
        }
      }
    }

    // Check for coordinated trades
    if (touchedTokens.size > 0) {
      await this.checkCoordinatedTrades(touchedTokens);
    }

    return { processed: totalProcessed };
  }
}
