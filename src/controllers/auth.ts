import { Request, Response } from "express";
import { Logger } from "../lib/logger.js";
import jwt from "jsonwebtoken";

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export class AuthController {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = "24h";
  
  // In production, these should be in database with hashed passwords
  private readonly USERS = [
    {
      id: "1",
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "changeme",
      role: "admin"
    }
  ];

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
    
    if (this.JWT_SECRET === "your-secret-key-change-in-production") {
      Logger.warn("Using default JWT_SECRET. Please set JWT_SECRET environment variable in production!");
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body as LoginRequest;

      if (!username || !password) {
        res.status(400).json({ 
          error: "Username and password are required" 
        });
        return;
      }

      // Find user
      const user = this.USERS.find(
        u => u.username === username && u.password === password
      );

      if (!user) {
        Logger.warn("Failed login attempt", { username });
        res.status(401).json({ 
          error: "Invalid credentials" 
        });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        },
        this.JWT_SECRET,
        { expiresIn: this.JWT_EXPIRES_IN }
      );

      Logger.info("User logged in", { username: user.username, role: user.role });

      res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      Logger.error("Login error", { error });
      res.status(500).json({ 
        error: "Internal server error" 
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      // With JWT, logout is typically handled client-side by removing the token
      // Optionally, you could implement a token blacklist here
      
      const user = (req as any).user;
      if (user) {
        Logger.info("User logged out", { username: user.username });
      }

      res.json({ 
        ok: true, 
        message: "Logged out successfully" 
      });
    } catch (error) {
      Logger.error("Logout error", { error });
      res.status(500).json({ 
        error: "Internal server error" 
      });
    }
  }

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // User is already set by jwtAuth middleware
      const user = req.user;
      
      if (!user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      res.json({
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      Logger.error("Get current user error", { error });
      res.status(500).json({ 
        error: "Internal server error" 
      });
    }
  }
}
