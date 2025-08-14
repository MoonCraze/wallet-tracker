import { Request, Response } from "express";

export class HealthController {
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
}
