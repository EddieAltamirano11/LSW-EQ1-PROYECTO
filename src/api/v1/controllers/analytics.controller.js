import * as QuantService from '../services/quant.service.js';
import * as HedgingService from '../services/hedging.service.js';
import boom from '@hapi/boom';

// Consulta de métricas financieras agregadas (Costo neto, Max Profit/Loss, Delta neto)
export const getStrategyMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const metrics = await HedgingService.getStrategyMetrics(id, req.dbTarget);
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

// Cálculo de letras griegas agregadas (Delta, Gamma, Vega, Theta, Rho)
export const calculateGreeks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const strategy = await HedgingService.getStrategyById(id, req.dbTarget);
    const greeksAnalysis = QuantService.calculateStrategyGreeks(strategy);
    res.status(200).json({
      message: 'Sensibilidad y letras griegas agregadas calculadas exitosamente.',
      data: greeksAnalysis,
    });
  } catch (error) {
    next(error);
  }
};

// Simulación de cobertura con prima neta F0 y precio futuro F2
export const simulateF0F2 = async (req, res, next) => {
  try {
    const { id } = req.params;
    const strategy = await HedgingService.getStrategyById(id, req.dbTarget);
    const simulation = QuantService.simulateF0F2Hedging(strategy, req.body);
    res.status(200).json({
      message: 'Escenario de cobertura F0/F2 simulado exitosamente.',
      data: simulation,
    });
  } catch (error) {
    next(error);
  }
};

// Estimación de volatilidad implícita vía método numérico Newton-Raphson
export const computeImpliedVolatility = async (req, res, next) => {
  try {
    const { marketPrice, spotPrice, strikePrice, timeToExpirationYears } = req.body;
    if (!marketPrice || !spotPrice || !strikePrice || !timeToExpirationYears) {
      throw boom.badRequest('marketPrice, spotPrice, strikePrice y timeToExpirationYears son obligatorios.');
    }
    const result = QuantService.calculateImpliedVolatility(req.body);
    res.status(200).json({
      message: 'Volatilidad implícita calculada exitosamente vía Newton-Raphson.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Generación de matriz vectorial de pagos (Payoff Matrix) y curva de expiración
export const getPayoffMatrix = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { steps = 25, rangePct = 0.25 } = req.query;
    const matrix = await HedgingService.generatePayoffMatrix(
      id,
      { steps: Number(steps), rangePct: Number(rangePct) },
      req.dbTarget
    );
    res.status(200).json(matrix);
  } catch (error) {
    next(error);
  }
};
