import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Logger } from "../lib/logger.js";

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized - No token provided" });
    return;
  }

  const token = authHeader.substring(7);
  const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (error) {
    Logger.warn("JWT verification failed", { error });
    res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
}

// Optional: Role-based authorization middleware
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden - Insufficient permissions" });
      return;
    }

    next();
  };
}
