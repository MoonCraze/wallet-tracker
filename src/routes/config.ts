import { Router } from "express";
import { ConfigController } from "../controllers/config.js";

const router = Router();
const configController = new ConfigController();

router.get("/config", (req, res, next) => {
  configController.getConfig(req, res).catch(next);
});

router.patch("/config", (req, res, next) => {
  configController.updateConfig(req, res).catch(next);
});

// Exclude tokens management
router.get("/config/exclude-tokens", (req, res, next) => {
  configController.getExcludeTokens(req, res).catch(next);
});

router.post("/config/exclude-tokens", (req, res, next) => {
  configController.addExcludeToken(req, res).catch(next);
});

router.delete("/config/exclude-tokens/:tokenAddress", (req, res, next) => {
  configController.removeExcludeToken(req, res).catch(next);
});

export { router as configRoutes };
