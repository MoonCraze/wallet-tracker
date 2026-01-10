import { Router } from "express";
import { AuthController } from "../controllers/auth.js";
import { jwtAuth } from "../middleware/jwtAuth.js";

const router = Router();
const authController = new AuthController();

// Public routes
router.post("/login", authController.login.bind(authController));

// Protected routes (require valid JWT)
router.post("/logout", jwtAuth, authController.logout.bind(authController));
router.get("/me", jwtAuth, authController.getCurrentUser.bind(authController));

export { router as authRoutes };
