import { Router } from "express";
import { HealthController } from "../controllers/health.js";
const router = Router();
const healthController = new HealthController();
router.get("/health", (req, res, next) => {
    healthController.healthCheck(req, res).catch(next);
});
export { router as healthRoutes };
