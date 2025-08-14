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
    
    try {
      const result = await this.webhookService.processWebhook(req.body, req.headers);
      
      const duration = Date.now() - startTime;
      Logger.info("Webhook processed successfully", {
        processed: result.processed,
        duration: `${duration}ms`
      });

      res.status(200).json({ 
        ok: true, 
        processed: result.processed,
        duration 
      });
    } catch (error) {
      Logger.error("Webhook processing failed", { error });
      res.status(500).json({ 
        ok: false, 
        error: "Internal server error" 
      });
    }
  }
}
