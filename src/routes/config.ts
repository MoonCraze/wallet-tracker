import { Router } from "express";
import { ConfigController } from "../controllers/config.js";

const router = Router();
const configController = new ConfigController();

// All routes here are protected by JWT (applied in app.ts)
// Routes are mounted at /config, so paths are relative

router.get("/", (req, res, next) => {
  configController.getConfig(req, res).catch(next);
});

router.patch("/", (req, res, next) => {
  configController.updateConfig(req, res).catch(next);
});

// Exclude tokens management
router.get("/exclude-tokens", (req, res, next) => {
  configController.getExcludeTokens(req, res).catch(next);
});

router.post("/exclude-tokens", (req, res, next) => {
  configController.addExcludeToken(req, res).catch(next);
});

router.delete("/exclude-tokens/:tokenAddress", (req, res, next) => {
  configController.removeExcludeToken(req, res).catch(next);
});

export { router as configRoutes };
