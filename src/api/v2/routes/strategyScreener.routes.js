import { Router } from 'express';
import boom from '@hapi/boom';
import {
  parseScreenerInput, parseTechnicalSymbol, runStrategyScreener, runTechnicalSeries,
} from '../services/strategyScreener.service.js';

export function strategyScreenerRoutes(run = runStrategyScreener, series = runTechnicalSeries) {
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
  // Serie técnica del Core 001 para la gráfica; es de solo lectura y no requiere evaluar los cores.
  router.get('/technical/:symbol', async (req, res, next) => {
    try {
      if (!req.user) throw boom.unauthorized('La consulta requiere una sesión válida.');
      res.status(200).json(await series(parseTechnicalSymbol(req.params.symbol)));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
