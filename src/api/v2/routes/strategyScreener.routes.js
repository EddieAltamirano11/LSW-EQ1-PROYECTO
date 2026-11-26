import { Router } from 'express';
import boom from '@hapi/boom';
import {
  parseScreenerInput, parseTechnicalSymbol, runStrategyScreener, runTechnicalSeries,
} from '../services/strategyScreener.service.js';
import { parseAiAnalysisInput, runAiAnalysis } from '../services/strategyScreener/aiAnalysis.js';

export function strategyScreenerRoutes(run = runStrategyScreener, series = runTechnicalSeries, analyze = runAiAnalysis) {
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
  router.post('/ai-analysis', async (req, res, next) => {
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    try {
      if (!req.user) throw boom.unauthorized('La consulta requiere una sesión válida.');
      const result = await analyze(parseAiAnalysisInput(req.body), controller.signal);
      if (!controller.signal.aborted) res.status(200).json(result);
    } catch (error) {
      if (!controller.signal.aborted) next(error);
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
