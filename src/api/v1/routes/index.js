import { Router } from 'express';
import mongoose from 'mongoose';
import config from '../../../config/config.js';
import authRoutes from './auth.routes.js';
import underlyingRoutes from './underlying.routes.js';
import hedgingRoutes from './hedging.routes.js';
import strategyRoutes from './strategy.routes.js';
import analyticsRoutes from './analytics.routes.js';
import quantRoutes from './quant.routes.js';
import brokerRoutes from './broker.routes.js';
import marketRoutes from './market.routes.js';
import docsRoutes from './docs.routes.js';

const routerAPI = (app) => {
  const router = Router();

  app.use(config.API_URL, router);
  app.use('/docs', docsRoutes);

  router.use('/auth', authRoutes);
  router.use('/underlyings', underlyingRoutes);
  router.use('/hedging', hedgingRoutes);
  router.use('/hedging-strategies', hedgingRoutes);
  router.use('/strategies', strategyRoutes);
  router.use('/analytics', analyticsRoutes);
  router.use('/quant', quantRoutes);
  router.use('/broker', brokerRoutes);
  router.use('/market', marketRoutes);
  router.use('/docs', docsRoutes);

  // Health check modular con estado real de dependencias
  router.get('/health', (req, res) => {
    const mongoStates = ['DISCONNECTED', 'CONNECTED', 'CONNECTING', 'DISCONNECTING'];
    const mongodb = mongoStates[mongoose.connection.readyState] || 'UNKNOWN';

    res.status(200).json({
      status: mongodb === 'CONNECTED' ? 'UP' : 'DEGRADED',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb,
        supabase: config.SUPABASE_URL ? 'CONFIGURED' : 'NOT_CONFIGURED',
        alpaca: config.ALPACA_API_KEY_ID ? 'CONFIGURED' : 'NOT_CONFIGURED',
      },
      activeDatabase: req.dbTarget,
    });
  });

  return router;
};

export default routerAPI;
