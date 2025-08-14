import { Request, Response, NextFunction } from "express";
import { verifyHeliusSecret } from "../verify.js";
import { getEnv } from "../lib/env.js";
import { AppError } from "./error.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const env = getEnv();
  const authorized = verifyHeliusSecret(req, env.WEBHOOK_SECRET);
  
  if (!authorized) {
    throw new AppError(401, "Unauthorized");
  }
  
  next();
}
