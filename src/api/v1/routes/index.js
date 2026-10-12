import { Router } from 'express';
import config from '../../../config/config.js';
import authRoutes from './auth.routes.js';
import underlyingRoutes from './underlying.routes.js';
import hedgingRoutes from './hedging.routes.js';
import strategyRoutes from './strategy.routes.js';
import analyticsRoutes from './analytics.routes.js';
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
  router.use('/broker', brokerRoutes);
  router.use('/market', marketRoutes);
  router.use('/docs', docsRoutes);

  // Health check modular
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};

export default routerAPI;
