import * as ScannerService from '../services/scanner.service.js';

/**
 * Escanea el mercado bursátil y genera el ranking Top 5 o Top 10 para Collar Spreads
 */
export const getTopCollars = async (req, res, next) => {
  try {
    const {
      limit = 5,
      sortBy = 'probability',
      dteHorizon = 45,
      broker,
    } = req.query;

    const result = await ScannerService.scanTopCollars({
      limit,
      sortBy,
      dteHorizon,
      broker: broker || req.brokerTarget,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Consulta los criterios técnicos y cuantitativos oficiales para seleccionar empresas
 */
export const getCompanyCriteria = async (req, res, next) => {
  try {
    const criteria = ScannerService.getCompanyCriteria();
    res.status(200).json(criteria);
  } catch (error) {
    next(error);
  }
};

/**
 * Consulta los parámetros y widgets de TradingView para un activo específico
 */
export const getTradingViewConfig = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const config = ScannerService.getTradingViewConfig(symbol);
    res.status(200).json(config);
  } catch (error) {
    next(error);
  }
};
