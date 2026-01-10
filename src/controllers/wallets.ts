import { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { Logger } from "../lib/logger.js";
import { WalletSyncService } from "../services/walletSync.js";

const WALLETS_FILE_PATH = path.join(process.cwd(), "src", "wallets.json");
const WALLETS_API_ENDPOINT = process.env.WALLETS_API_ENDPOINT || "";

interface WalletApiData {
  wallet_address: string;
  [key: string]: any;
}

export class WalletsController {
  /**
   * Get the current wallet list from cloud API with local file fallback
   */
  async getWallets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.info('Fetching wallet list');
      
      // Try cloud API first if configured
      if (WALLETS_API_ENDPOINT) {
        try {
          Logger.info('Attempting to fetch from cloud API', { endpoint: WALLETS_API_ENDPOINT });
          
          const response = await axios.get<WalletApiData[]>(WALLETS_API_ENDPOINT, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
          });

          if (Array.isArray(response.data)) {
            const wallets = response.data
              .slice(0, 100)
              .map(item => item.wallet_address)
              .filter(addr => typeof addr === 'string' && addr.length > 0);

            if (wallets.length > 0) {
              Logger.info(`Fetched ${wallets.length} wallets from cloud API`);
              res.json({
                success: true,
                count: wallets.length,
                source: 'cloud-api',
                wallets
              });
              return;
            }
          }
        } catch (apiError) {
          Logger.warn('Cloud API fetch failed, falling back to local file', { 
            error: axios.isAxiosError(apiError) ? {
              status: apiError.response?.status,
              message: apiError.message
            } : apiError
          });
        }
      }
      
      // Fallback to local file
      const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const wallets = JSON.parse(fileContent);
      
      res.json({
        success: true,
        count: wallets.length,
        source: 'local-file',
        wallets
      });
    } catch (error) {
      Logger.error('Failed to fetch wallets', { error });
      next(error);
    }
  }

  /**
   * Update the wallet list
   */
  async updateWallets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { wallets } = req.body;

      // Validate input
      if (!Array.isArray(wallets)) {
        res.status(400).json({
          success: false,
          error: 'Wallets must be an array'
        });
        return;
      }

      // Validate each wallet address
      const invalidWallets = wallets.filter(wallet => 
        typeof wallet !== 'string' || 
        wallet.trim().length === 0 ||
        wallet.length < 32 || 
        wallet.length > 44
      );

      if (invalidWallets.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid wallet addresses detected',
          invalidWallets
        });
        return;
      }

      // Remove duplicates and trim
      let uniqueWallets = [...new Set(wallets.map((w: string) => w.trim()))];

      // Enforce maximum limit of 100 wallets
      const exceededLimit = uniqueWallets.length > 100;
      if (exceededLimit) {
        uniqueWallets = uniqueWallets.slice(0, 100);
      }

      Logger.info('Updating wallet list', { 
        previousCount: (await this.getCurrentWalletCount()),
        newCount: uniqueWallets.length,
        exceededLimit,
        totalProvided: wallets.length
      });

      // Write to file
      await fs.writeFile(
        WALLETS_FILE_PATH, 
        JSON.stringify(uniqueWallets, null, 2),
        'utf-8'
      );

      // Trigger a sync with the new wallet list
      const walletSync = WalletSyncService.getInstance();
      if (walletSync) {
        Logger.info('Triggering wallet sync with updated list');
        walletSync.syncNow().catch(err => {
          Logger.error('Failed to sync updated wallet list', { error: err });
        });
      }

      const response: any = {
        success: true,
        message: exceededLimit 
          ? 'Wallet list updated successfully (limited to 100 wallets)'
          : 'Wallet list updated successfully',
        count: uniqueWallets.length,
        wallets: uniqueWallets
      };

      if (exceededLimit) {
        response.warning = `Maximum limit of 100 wallets enforced. ${wallets.length - 100} wallet(s) were excluded.`;
        response.totalProvided = wallets.length;
      }

      res.json(response);
    } catch (error) {
      Logger.error('Failed to update wallets', { error });
      next(error);
    }
  }

  /**
   * Add wallets to the existing list
   */
  async addWallets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { wallets } = req.body;

      if (!Array.isArray(wallets)) {
        res.status(400).json({
          success: false,
          error: 'Wallets must be an array'
        });
        return;
      }

      // Get current wallets
      const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const currentWallets = JSON.parse(fileContent);

      // Merge and deduplicate
      let allWallets = [...new Set([...currentWallets, ...wallets.map((w: string) => w.trim())])];

      // Validate
      const invalidWallets = allWallets.filter(wallet => 
        typeof wallet !== 'string' || 
        wallet.trim().length === 0 ||
        wallet.length < 32 || 
        wallet.length > 44
      );

      if (invalidWallets.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid wallet addresses detected',
          invalidWallets
        });
        return;
      }

      // Enforce maximum limit of 100 wallets
      const exceededLimit = allWallets.length > 100;
      const actualAdded = allWallets.length - currentWallets.length;
      if (exceededLimit) {
        allWallets = allWallets.slice(0, 100);
      }

      Logger.info('Adding wallets to list', { 
        previousCount: currentWallets.length,
        newCount: allWallets.length,
        added: allWallets.length - currentWallets.length,
        exceededLimit,
        excluded: exceededLimit ? (currentWallets.length + actualAdded - 100) : 0
      });

      // Write to file
      await fs.writeFile(
        WALLETS_FILE_PATH, 
        JSON.stringify(allWallets, null, 2),
        'utf-8'
      );

      // Trigger sync
      const walletSync = WalletSyncService.getInstance();
      if (walletSync) {
        walletSync.syncNow().catch(err => {
          Logger.error('Failed to sync after adding wallets', { error: err });
        });
      }

      const response: any = {
        success: true,
        message: exceededLimit 
          ? 'Wallets added successfully (limited to 100 total)'
          : 'Wallets added successfully',
        added: allWallets.length - currentWallets.length,
        totalCount: allWallets.length
      };

      if (exceededLimit) {
        response.warning = `Maximum limit of 100 wallets enforced. Some wallets were excluded to maintain the limit.`;
        response.excluded = currentWallets.length + actualAdded - 100;
      }

      res.json(response);
    } catch (error) {
      Logger.error('Failed to add wallets', { error });
      next(error);
    }
  }

  /**
   * Remove wallets from the list
   */
  async removeWallets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { wallets } = req.body;

      if (!Array.isArray(wallets)) {
        res.status(400).json({
          success: false,
          error: 'Wallets must be an array'
        });
        return;
      }

      // Get current wallets
      const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const currentWallets = JSON.parse(fileContent);

      // Remove specified wallets
      const walletsToRemove = new Set(wallets.map((w: string) => w.trim()));
      const remainingWallets = currentWallets.filter((w: string) => !walletsToRemove.has(w));

      Logger.info('Removing wallets from list', { 
        previousCount: currentWallets.length,
        newCount: remainingWallets.length,
        removed: currentWallets.length - remainingWallets.length
      });

      // Write to file
      await fs.writeFile(
        WALLETS_FILE_PATH, 
        JSON.stringify(remainingWallets, null, 2),
        'utf-8'
      );

      res.json({
        success: true,
        message: 'Wallets removed successfully',
        removed: currentWallets.length - remainingWallets.length,
        totalCount: remainingWallets.length
      });
    } catch (error) {
      Logger.error('Failed to remove wallets', { error });
      next(error);
    }
  }

  private async getCurrentWalletCount(): Promise<number> {
    try {
      const fileContent = await fs.readFile(WALLETS_FILE_PATH, 'utf-8');
      const wallets = JSON.parse(fileContent);
      return wallets.length;
    } catch {
      return 0;
    }
  }
}
