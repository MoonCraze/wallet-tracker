import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { validateEnv, getEnv } from "./lib/env.js";
import { Logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { jwtAuth } from "./middleware/jwtAuth.js";
import { initRealtime } from "./realtime.js";
import { CoordinatedTradeScanner } from "./services/coordinator.js";
import { WalletSyncService } from "./services/walletSync.js";
import { webhookRoutes } from "./routes/webhook.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { walletsRoutes } from "./routes/wallets.js";
import { prisma } from "./db.js";

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

// Serve static files from public directory
app.use(express.static('public'));

// JSON parsing middleware for webhook routes only
app.use('/helius', express.json({ 
  limit: "10mb", 
  type: ["application/json", "application/*+json"] 
}));

// JSON parsing for config routes
app.use('/config', express.json());

// JSON parsing for auth routes
app.use('/api/auth', express.json());

// JSON parsing for wallets routes
app.use('/api/wallets', express.json());

// Routes
app.use(healthRoutes);
app.use('/config', jwtAuth, configRoutes);  // Protected: requires JWT
app.use(webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletsRoutes);  // Protected: requires JWT

// Development endpoints (if enabled) - Protected with JWT
if (env.ALLOW_DEV_ENDPOINTS) {
  app.get('/dev/ping', jwtAuth, (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));
  
  app.get('/dev/db/transfers', jwtAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;
      
      // Build where clause for time filtering with proper validation
      const where: any = {};
      const hasTimeFilter = !!(startTime || endTime);
      
      if (hasTimeFilter) {
        where.timestamp = {};
        if (startTime) {
          const date = new Date(startTime);
          if (isNaN(date.getTime())) {
            return res.status(400).json({ error: 'Invalid startTime format. Use ISO 8601 format.' });
          }
          where.timestamp.gte = date;
        }
        if (endTime) {
          const date = new Date(endTime);
          if (isNaN(date.getTime())) {
            return res.status(400).json({ error: 'Invalid endTime format. Use ISO 8601 format.' });
          }
          where.timestamp.lte = date;
        }
      }
      
      // Only apply limit when no time filtering (to get all results in time range)
      const transfers = await prisma.transferEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        ...(hasTimeFilter ? {} : { take: limit })
      });
      
      // Format response to match documentation structure
      const formatted = transfers.map((t: any) => ({
        id: t.id,
        signature: t.signature,
        timestamp: t.timestamp instanceof Date ? t.timestamp.toISOString() : t.timestamp,
        walletAddress: t.walletAddress,
        tokenAddress: t.tokenAddress,
        amount: t.amount,
        side: t.side,
      }));
      
      res.json(formatted);
    } catch (error) {
      Logger.error('Failed to fetch transfers', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/dev/db/coordinated', jwtAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const coordinated = await prisma.coordinatedTrade.findMany({
        orderBy: { triggeredAt: 'desc' },
        take: limit
      });
      
      // Format response to match documentation structure
      const formatted = coordinated.map((c: any) => {
        let wallets: string[] = [];
        try {
          wallets = JSON.parse(c.walletAddresses);
        } catch (e) {
          Logger.warn('Failed to parse walletAddresses', { id: c.id });
        }
        
        const timeWindowSeconds = Math.round(
          (new Date(c.windowEnd).getTime() - new Date(c.windowStart).getTime()) / 1000
        );
        
        return {
          id: c.id,
          timestamp: c.triggeredAt instanceof Date ? c.triggeredAt.toISOString() : c.triggeredAt,
          tokenAddress: c.tokenAddress,
          walletCount: c.uniqueWalletCount,
          wallets: wallets,
          timeWindowSeconds: timeWindowSeconds,
          pattern: 'simultaneous_buy' // Default pattern type
        };
      });
      
      res.json(formatted);
    } catch (error) {
      Logger.error('Failed to fetch coordinated trades', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/dev/db/stats', jwtAuth, async (req, res) => {
    try {
      // Parallelize all independent database queries for better performance
      const [
        transferCount,
        coordinatedCount,
        uniqueWalletsResult,
        uniqueTokensResult,
        oldestTransfer,
        newestTransfer
      ] = await Promise.all([
        prisma.transferEvent.count(),
        prisma.coordinatedTrade.count(),
        prisma.transferEvent.findMany({
          select: { walletAddress: true },
          distinct: ['walletAddress']
        }),
        prisma.transferEvent.findMany({
          select: { tokenAddress: true },
          distinct: ['tokenAddress']
        }),
        prisma.transferEvent.findFirst({
          orderBy: { timestamp: 'asc' },
          select: { timestamp: true }
        }),
        prisma.transferEvent.findFirst({
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true }
        })
      ]);
      
      res.json({
        transferCount,
        coordinatedCount,
        uniqueWallets: uniqueWalletsResult.length,
        uniqueTokens: uniqueTokensResult.length,
        oldestTransfer: oldestTransfer?.timestamp instanceof Date 
          ? oldestTransfer.timestamp.toISOString() 
          : oldestTransfer?.timestamp || null,
        newestTransfer: newestTransfer?.timestamp instanceof Date 
          ? newestTransfer.timestamp.toISOString() 
          : newestTransfer?.timestamp || null
      });
    } catch (error) {
      Logger.error('Failed to fetch database stats', { error });
      res.status(500).json({ error: 'Internal server error' });
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
