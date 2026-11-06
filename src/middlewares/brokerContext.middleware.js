import config from '../config/config.js';

/**
 * Middleware de Contexto de Broker Unificado
 * Filosofía de Arquitectura: Los Headers HTTP (x-broker-selection) son la autoridad única
 * y definitiva de infraestructura para determinar el broker de ejecución bursátil.
 */
export const brokerContextMiddleware = (req, res, next) => {
  // 1. Autoridad única de infraestructura: Encabezado institucional x-broker-selection
  const headerSelection = req.headers['x-broker-selection']?.toUpperCase();

  // 2. Parámetro query en URL para peticiones GET desde navegadores (?broker=IBKR)
  const querySelection = req.query?.broker?.toUpperCase();

  // 3. Fallback de configuración por defecto
  const defaultBroker = config.DEFAULT_BROKER || 'WEBULL';

  let selected = defaultBroker;
  if (['WEBULL', 'ALPACA', 'IBKR', 'SIMULATED'].includes(headerSelection)) {
    selected = headerSelection;
  } else if (['WEBULL', 'ALPACA', 'IBKR', 'SIMULATED'].includes(querySelection)) {
    selected = querySelection;
  } else if (req.body?.broker && ['WEBULL', 'ALPACA', 'IBKR', 'SIMULATED'].includes(String(req.body.broker).toUpperCase())) {
    selected = String(req.body.broker).toUpperCase();
  }

  // Establecer el broker rector en la petición
  req.broker = selected;

  // Normalizar el body para que jamás exista discrepancia interna entre header y payload
  if (req.body && typeof req.body === 'object') {
    req.body.broker = selected;
  }

  // Exponer cabecera de observabilidad en la respuesta HTTP
  res.setHeader('X-Active-Broker', selected);
  next();
};

export default brokerContextMiddleware;
