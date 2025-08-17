import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { publishCoordinated } from "../realtime.js";
import { Logger } from "../lib/logger.js";

export class CoordinatedTradeScanner {
  private scanInterval?: NodeJS.Timeout;

  private floorToWindowStart(date: Date): Date {
    const config = getConfig();
    const windowMs = Math.max(1, config.coordinatedWindowMinutes) * 60_000;
    const timestamp = date.getTime();
    return new Date(Math.floor(timestamp / windowMs) * windowMs);
  }

  private async scanForCoordinatedTrades(): Promise<void> {
    try {
      const config = getConfig();
      const now = new Date();
  const currentWindowStart = this.floorToWindowStart(now);
  // Scan the current bucket and trigger within it
  const windowStart = new Date(currentWindowStart.getTime());
  const windowEnd = new Date(currentWindowStart.getTime() + (config.coordinatedWindowMinutes * 60_000));

      Logger.debug("Background scan for coordinated trades", {
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString()
      });

    // Find tokens with BUY activity in the window up to now
      const tokensWithBuys = await prisma.transferEvent.findMany({
        where: { 
          side: "BUY", 
      timestamp: { gte: windowStart, lt: now } 
        },
        select: { tokenAddress: true },
        distinct: ["tokenAddress"]
      });

      Logger.debug(`Found ${tokensWithBuys.length} tokens with BUY activity`);

      for (const { tokenAddress } of tokensWithBuys) {
        if (getConfig().excludeTokensSet.has(tokenAddress)) continue;
        await this.checkTokenForCoordination(tokenAddress, windowStart, windowEnd, now);
      }
    } catch (error) {
      Logger.warn("Background scan failed", { error });
    }
  }

  private async checkTokenForCoordination(
    tokenAddress: string,
    windowStart: Date,
    windowEnd: Date,
    triggeredAt: Date
  ): Promise<void> {
    const config = getConfig();

    // Check if already processed for this token and window
    const existing = await prisma.coordinatedTrade.findFirst({
      where: { tokenAddress, windowStart },
      select: { id: true }
    });

    if (existing) {
      return;
    }

  // Count unique wallets with BUY transactions (up to trigger time only)
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
        const coordinatedTrade = await prisma.coordinatedTrade.create({
          data: {
            tokenAddress,
            windowStart,
            windowEnd,
            triggeredAt,
            uniqueWalletCount: uniqueWallets.length,
            walletAddresses: JSON.stringify(uniqueWallets)
          }
        });

        publishCoordinated({
          tokenAddress,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          triggeredAt: triggeredAt.toISOString(),
          uniqueWalletCount: coordinatedTrade.uniqueWalletCount,
          walletAddresses: uniqueWallets
        });

        Logger.info("Background scan detected coordinated trade", {
          tokenAddress,
          windowStart: windowStart.toISOString(),
          uniqueWalletCount: uniqueWallets.length
        });
      } catch (error) {
        Logger.warn("Failed to create coordinated trade from background scan", {
          tokenAddress,
          error
        });
      }
    }
  }

  start(): void {
    if (this.scanInterval) {
      return;
    }

    const scan = async () => {
      await this.scanForCoordinatedTrades();
      
      // Schedule next scan based on current window configuration
      const config = getConfig();
      const windowMs = config.coordinatedWindowMinutes * 60_000;
      const intervalMs = Math.min(60_000, Math.max(10_000, Math.floor(windowMs / 2)));
      
      this.scanInterval = setTimeout(scan, intervalMs);
    };

    // Start first scan
    scan();
    Logger.info("Started coordinated trade background scanner");
  }

  stop(): void {
    if (this.scanInterval) {
      clearTimeout(this.scanInterval);
      this.scanInterval = undefined;
      Logger.info("Stopped coordinated trade background scanner");
    }
  }
}
