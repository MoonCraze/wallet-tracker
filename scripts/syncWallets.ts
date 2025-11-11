#!/usr/bin/env tsx
/**
 * Manual script to sync wallets from API endpoint
 * Usage: npm run wallets:sync
 * or: tsx scripts/syncWallets.ts
 */

import "dotenv/config";
import { WalletSyncService } from "../src/services/walletSync.js";
import { Logger } from "../src/lib/logger.js";

async function main() {
  Logger.info("=== Manual Wallet Sync Script ===");
  
  const apiEndpoint = process.env.WALLETS_API_ENDPOINT;
  
  if (!apiEndpoint) {
    Logger.error("WALLETS_API_ENDPOINT environment variable is not set");
    Logger.info("Please set it in your .env file or as an environment variable");
    Logger.info("Example: WALLETS_API_ENDPOINT=https://api.example.com/top-wallets");
    process.exit(1);
  }

  Logger.info(`Using API endpoint: ${apiEndpoint}`);
  
  const walletSync = new WalletSyncService(apiEndpoint);
  
  try {
    await walletSync.syncWallets();
    Logger.info("✅ Wallet sync completed successfully");
    process.exit(0);
  } catch (error) {
    Logger.error("❌ Wallet sync failed", { error });
    process.exit(1);
  }
}

main();
