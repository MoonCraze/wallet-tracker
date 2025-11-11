import axios from "axios";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WalletData {
  wallet_address: string;
  token_address: string;
  gross_profit: number;
  realized_profit: number;
  realized_profit_percent: number;
  unrealized_profit: number;
  unrealized_profit_percent: number;
  win_rate: number;
  wins: number;
  losses: number;
  trade_volume: number;
  trades: number;
  avg_trade_size: number;
  is_bot: number;
}

export class WalletSyncService {
  private apiEndpoint: string;
  private walletsFilePath: string;
  private isRunning: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(apiEndpoint?: string) {
    this.apiEndpoint = apiEndpoint || process.env.WALLETS_API_ENDPOINT || "";
    this.walletsFilePath = join(__dirname, "..", "wallets.json");
  }

  /**
   * Fetch top 100 wallets from the API endpoint
   */
  async fetchTopWallets(): Promise<string[]> {
    if (!this.apiEndpoint) {
      Logger.warn("No WALLETS_API_ENDPOINT configured, skipping wallet sync");
      return [];
    }

    try {
      Logger.info("Fetching top 100 wallets from API...", { endpoint: this.apiEndpoint });
      
      const response = await axios.get<WalletData[]>(this.apiEndpoint, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!Array.isArray(response.data)) {
        throw new Error("API response is not an array");
      }

      // Extract wallet addresses and take first 100
      const walletAddresses = response.data
        .slice(0, 100)
        .map((wallet) => wallet.wallet_address)
        .filter((address) => typeof address === "string" && address.length > 0);

      if (walletAddresses.length === 0) {
        throw new Error("No valid wallet addresses found in API response");
      }

      Logger.info(`Successfully fetched ${walletAddresses.length} wallet addresses`);
      return walletAddresses;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        Logger.error("Failed to fetch wallets from API", {
          endpoint: this.apiEndpoint,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
        });
      } else {
        Logger.error("Unexpected error fetching wallets", { error });
      }
      throw error;
    }
  }

  /**
   * Update wallets.json file with new wallet addresses
   */
  async updateWalletsFile(walletAddresses: string[]): Promise<void> {
    try {
      const jsonContent = JSON.stringify(walletAddresses, null, 2);
      await fs.writeFile(this.walletsFilePath, jsonContent, "utf-8");
      
      Logger.info(`Successfully updated wallets.json with ${walletAddresses.length} addresses`, {
        filePath: this.walletsFilePath,
      });
    } catch (error) {
      Logger.error("Failed to write wallets.json file", {
        filePath: this.walletsFilePath,
        error,
      });
      throw error;
    }
  }

  /**
   * Perform the sync operation
   */
  async syncWallets(): Promise<void> {
    if (!this.apiEndpoint) {
      Logger.info("Wallet sync skipped: No API endpoint configured");
      return;
    }

    try {
      Logger.info("Starting wallet sync...");
      const wallets = await this.fetchTopWallets();
      
      if (wallets.length > 0) {
        await this.updateWalletsFile(wallets);
        Logger.info("Wallet sync completed successfully");
      } else {
        Logger.warn("No wallets fetched, skipping file update");
      }
    } catch (error) {
      Logger.error("Wallet sync failed", { error });
    }
  }

  /**
   * Calculate milliseconds until next midnight (00:00:00)
   */
  private getMillisecondsUntilMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
  }

  /**
   * Schedule next sync at midnight
   */
  private scheduleNextSync(): void {
    const msUntilMidnight = this.getMillisecondsUntilMidnight();
    const hours = Math.floor(msUntilMidnight / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));

    Logger.info(`Next wallet sync scheduled in ${hours}h ${minutes}m (at midnight)`);

    this.syncInterval = setTimeout(async () => {
      await this.syncWallets();
      // Schedule next sync (24 hours from now)
      this.scheduleNextSync();
    }, msUntilMidnight);
  }

  /**
   * Start the wallet sync service
   * Performs initial sync and schedules daily syncs at midnight
   */
  async start(performInitialSync: boolean = false): Promise<void> {
    if (this.isRunning) {
      Logger.warn("Wallet sync service is already running");
      return;
    }

    this.isRunning = true;
    Logger.info("Starting wallet sync service...");

    // Perform initial sync if requested
    if (performInitialSync) {
      await this.syncWallets();
    }

    // Schedule daily sync at midnight
    this.scheduleNextSync();

    Logger.info("Wallet sync service started successfully");
  }

  /**
   * Stop the wallet sync service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.syncInterval) {
      clearTimeout(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
    Logger.info("Wallet sync service stopped");
  }

  /**
   * Get the current status of the service
   */
  getStatus(): { isRunning: boolean; apiEndpoint: string; walletsFilePath: string } {
    return {
      isRunning: this.isRunning,
      apiEndpoint: this.apiEndpoint,
      walletsFilePath: this.walletsFilePath,
    };
  }
}
