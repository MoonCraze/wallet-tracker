import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { validateEnv, getEnv } from "./lib/env.js";
import { Logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { initRealtime } from "./realtime.js";
import { CoordinatedTradeScanner } from "./services/coordinator.js";
import { WalletSyncService } from "./services/walletSync.js";
import { webhookRoutes } from "./routes/webhook.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";

// Validate environment variables
const env = validateEnv();

// Create Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (env.ALLOWED_ORIGINS === '*') {
      return callback(null, true);
    }
    
    if (env.ALLOWED_ORIGINS) {
      const origins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      if (origins.includes(origin || '') || !origin) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    }
    
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-helius-secret'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// JSON parsing middleware for webhook routes only
app.use('/helius', express.json({ 
  limit: "10mb", 
  type: ["application/json", "application/*+json"] 
}));

// JSON parsing for config routes
app.use('/config', express.json());

// Routes
app.use(healthRoutes);
app.use(configRoutes);
app.use(webhookRoutes);

// Development endpoints (if enabled)
if (env.ALLOW_DEV_ENDPOINTS) {
  app.get('/dev/ping', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));
  
  app.get('/dev/db/transfers', async (req, res) => {
    try {
      const { default: { PrismaClient } } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const limit = parseInt(req.query.limit as string) || 50;
      const transfers = await prisma.transferEvent.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit
      });
      
      await prisma.$disconnect();
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch transfers' });
    }
  });

  app.get('/dev/db/coordinated', async (req, res) => {
    try {
      const { default: { PrismaClient } } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const limit = parseInt(req.query.limit as string) || 50;
      const coordinated = await prisma.coordinatedTrade.findMany({
        orderBy: { triggeredAt: 'desc' },
        take: limit
      });
      
      await prisma.$disconnect();
      res.json(coordinated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch coordinated trades' });
    }
  });

  app.get('/dev/db/stats', async (req, res) => {
    try {
      const { default: { PrismaClient } } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const transferCount = await prisma.transferEvent.count();
      const coordinatedCount = await prisma.coordinatedTrade.count();
      
      await prisma.$disconnect();
      res.json({ transferCount, coordinatedCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });
  
  Logger.info('Development endpoints enabled');
}

// Create HTTP server and initialize realtime features
const server = createServer(app);
initRealtime(app, server);

// Error handling (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Start coordinated trade background scanner
const coordinator = new CoordinatedTradeScanner();

// Initialize wallet sync service
const walletSync = new WalletSyncService();

// Graceful shutdown handling
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, shutting down gracefully');
  coordinator.stop();
  walletSync.stop();
  server.close(() => {
    Logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, shutting down gracefully');
  coordinator.stop();
  walletSync.stop();
  server.close(() => {
    Logger.info('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(env.PORT, () => {
  Logger.info(`🚀 Server started on port ${env.PORT}`, {
    environment: env.NODE_ENV,
    allowDevEndpoints: env.ALLOW_DEV_ENDPOINTS,
    coordinatedWindowMinutes: env.COORDINATED_WINDOW_MINUTES,
    coordinatedMinWallets: env.COORDINATED_MIN_WALLETS
  });

  // Start background services
  coordinator.start();
  
  // Start wallet sync service (with initial sync on first run)
  walletSync.start(true).catch(err => {
    Logger.error('Failed to start wallet sync service', { error: err });
  });
});
