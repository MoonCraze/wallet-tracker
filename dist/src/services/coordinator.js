import { prisma } from "../db.js";
import { getConfig } from "../config.js";
import { publishCoordinated } from "../realtime.js";
import { Logger } from "../lib/logger.js";
export class CoordinatedTradeScanner {
    scanInterval;
    floorToWindowStart(date) {
        const config = getConfig();
        const windowMs = Math.max(1, config.coordinatedWindowMinutes) * 60_000;
        const timestamp = date.getTime();
        return new Date(Math.floor(timestamp / windowMs) * windowMs);
    }
    async scanForCoordinatedTrades() {
        try {
            const config = getConfig();
            const now = new Date();
            const currentWindowStart = this.floorToWindowStart(now);
            const windowStart = new Date(currentWindowStart.getTime() - (config.coordinatedWindowMinutes * 60_000));
            const windowEnd = currentWindowStart;
            Logger.debug("Background scan for coordinated trades", {
                windowStart: windowStart.toISOString(),
                windowEnd: windowEnd.toISOString()
            });
            // Check if this window was already processed
            const existingWindow = await prisma.coordinatedTrade.findFirst({
                where: { windowStart },
                select: { id: true }
            });
            if (existingWindow) {
                Logger.debug("Window already processed, skipping background scan");
                return;
            }
            // Find tokens with BUY activity in the window
            const tokensWithBuys = await prisma.transferEvent.findMany({
                where: {
                    side: "BUY",
                    timestamp: { gte: windowStart, lt: windowEnd }
                },
                select: { tokenAddress: true },
                distinct: ["tokenAddress"]
            });
            Logger.debug(`Found ${tokensWithBuys.length} tokens with BUY activity`);
            for (const { tokenAddress } of tokensWithBuys) {
                await this.checkTokenForCoordination(tokenAddress, windowStart, windowEnd, now);
            }
        }
        catch (error) {
            Logger.warn("Background scan failed", { error });
        }
    }
    async checkTokenForCoordination(tokenAddress, windowStart, windowEnd, triggeredAt) {
        const config = getConfig();
        // Check if already processed for this token and window
        const existing = await prisma.coordinatedTrade.findFirst({
            where: { tokenAddress, windowStart },
            select: { id: true }
        });
        if (existing) {
            return;
        }
        // Count unique wallets with BUY transactions
        const buyers = await prisma.transferEvent.findMany({
            where: {
                tokenAddress,
                side: "BUY",
                timestamp: { gte: windowStart, lt: windowEnd }
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
            }
            catch (error) {
                Logger.warn("Failed to create coordinated trade from background scan", {
                    tokenAddress,
                    error
                });
            }
        }
    }
    start() {
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
    stop() {
        if (this.scanInterval) {
            clearTimeout(this.scanInterval);
            this.scanInterval = undefined;
            Logger.info("Stopped coordinated trade background scanner");
        }
    }
}
