import { Router } from 'express';
import boom from '@hapi/boom';
import { parseScreenerInput, runStrategyScreener } from '../services/strategyScreener.service.js';

export function strategyScreenerRoutes(run = runStrategyScreener) {
  const router = Router();
  router.post('/run', async (req, res, next) => {
    try {
      if (!req.user) throw boom.unauthorized('La consulta requiere una sesión válida.');
      const result = await run(parseScreenerInput(req.body));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
