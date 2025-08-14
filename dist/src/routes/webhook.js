import { Router } from "express";
import { WebhookController } from "../controllers/webhook.js";
import { authMiddleware } from "../middleware/auth.js";
const router = Router();
const webhookController = new WebhookController();
router.post("/helius", authMiddleware, (req, res, next) => {
    webhookController.handleWebhook(req, res).catch(next);
});
export { router as webhookRoutes };
