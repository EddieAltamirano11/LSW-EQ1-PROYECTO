import { Router } from 'express';
import config from '../../../config/config.js';

const routerAPI = (app) => {
  const router = Router();

  app.use(config.API_URL, router);

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
