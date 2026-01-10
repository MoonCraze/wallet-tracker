import { Router } from "express";
import { WalletsController } from "../controllers/wallets.js";
import { jwtAuth } from "../middleware/jwtAuth.js";

const router = Router();
const walletsController = new WalletsController();

// All wallet management routes require authentication
router.get("/", jwtAuth, walletsController.getWallets.bind(walletsController));
router.put("/", jwtAuth, walletsController.updateWallets.bind(walletsController));
router.post("/add", jwtAuth, walletsController.addWallets.bind(walletsController));
router.post("/remove", jwtAuth, walletsController.removeWallets.bind(walletsController));

export { router as walletsRoutes };
