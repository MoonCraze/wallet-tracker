import { Request, Response } from "express";
import { getConfig, setConfig, configToJSON } from "../config.js";
import { AppError } from "../middleware/error.js";

export class ConfigController {
  async getConfig(req: Request, res: Response): Promise<void> {
    const config = getConfig();
    res.json(configToJSON(config));
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const updated = setConfig(req.body || {});
      res.json(configToJSON(updated));
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "Invalid config");
    }
  }

  async getExcludeTokens(req: Request, res: Response): Promise<void> {
    const config = getConfig();
    res.json({ excludeTokens: config.excludeTokens });
  }

  async addExcludeToken(req: Request, res: Response): Promise<void> {
    try {
      const { tokenAddress } = req.body;
      if (!tokenAddress || typeof tokenAddress !== 'string') {
        throw new AppError(400, "tokenAddress is required and must be a string");
      }

      const config = getConfig();
      const currentTokens = new Set(config.excludeTokens);
      
      if (currentTokens.has(tokenAddress)) {
        res.json({ message: "Token already in exclude list", excludeTokens: config.excludeTokens });
        return;
      }

      const newTokens = [...config.excludeTokens, tokenAddress];
      const updated = setConfig({ excludeTokens: newTokens });
      res.json({ 
        message: "Token added to exclude list", 
        excludeTokens: updated.excludeTokens 
      });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "Failed to add token");
    }
  }

  async removeExcludeToken(req: Request, res: Response): Promise<void> {
    try {
      const { tokenAddress } = req.params;
      if (!tokenAddress) {
        throw new AppError(400, "tokenAddress is required");
      }

      const config = getConfig();
      const newTokens = config.excludeTokens.filter(token => token !== tokenAddress);
      
      if (newTokens.length === config.excludeTokens.length) {
        res.json({ message: "Token not found in exclude list", excludeTokens: config.excludeTokens });
        return;
      }

      const updated = setConfig({ excludeTokens: newTokens });
      res.json({ 
        message: "Token removed from exclude list", 
        excludeTokens: updated.excludeTokens 
      });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : "Failed to remove token");
    }
  }
}
