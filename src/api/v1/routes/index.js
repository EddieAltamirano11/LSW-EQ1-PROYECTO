import { Router } from 'express';
import config from '../../../config/config.js';
import authRoutes from './auth.routes.js';
import underlyingRoutes from './underlying.routes.js';
import hedgingRoutes from './hedging.routes.js';

const routerAPI = (app) => {
  const router = Router();

  app.use(config.API_URL, router);

  router.use('/auth', authRoutes);
  router.use('/underlyings', underlyingRoutes);
  router.use('/hedging', hedgingRoutes);
  router.use('/hedging-strategies', hedgingRoutes);

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
