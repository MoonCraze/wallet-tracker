import { Request, Response } from "express";
import { WebhookService } from "../services/webhook.js";
import { Logger } from "../lib/logger.js";

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    // Capture body and headers immediately (before response)
    const body = req.body;
    const headers = { ...req.headers };
    
    // Respond immediately to avoid tunnel timeout errors
    // Helius expects a fast 200 OK acknowledgment
    res.status(200).json({ ok: true, accepted: true });
    
    // Process webhook asynchronously in background
    this.processInBackground(body, headers, startTime);
  }

  private processInBackground(body: any, headers: any, startTime: number): void {
    // Use setImmediate to ensure response is sent before processing starts
    setImmediate(async () => {
      try {
        const result = await this.webhookService.processWebhook(body, headers);
        
        const duration = Date.now() - startTime;
        Logger.info("Webhook processed successfully", {
          processed: result.processed,
          duration: `${duration}ms`
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        Logger.error("Background webhook processing failed", { 
          error,
          duration: `${duration}ms`
        });
      }
    });
  }
}
