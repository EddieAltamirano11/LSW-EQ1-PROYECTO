import config from '../config/config.js';

export const brokerContextMiddleware = (req, res, next) => {
  // 1. Prioridad: Encabezado explícito x-broker-selection (ideal para clientes REST, Postman y OpenAPI)
  const headerSelection = req.headers['x-broker-selection']?.toUpperCase();

  // 2. Segunda prioridad: Parámetro de consulta query (?broker=WEBULL o ?broker=ALPACA)
  const querySelection = req.query?.broker?.toUpperCase();

  // 3. Broker por defecto configurado en .env (DEFAULT_BROKER=WEBULL)
  const defaultBroker = config.DEFAULT_BROKER || 'WEBULL';

  let selected = defaultBroker;
  if (['WEBULL', 'ALPACA', 'IBKR', 'SIMULATED'].includes(headerSelection)) {
    selected = headerSelection;
  } else if (['WEBULL', 'ALPACA', 'IBKR', 'SIMULATED'].includes(querySelection)) {
    selected = querySelection;
  }

  req.broker = selected;

  // Exponemos la cabecera en la respuesta HTTP para trazabilidad y observabilidad
  res.setHeader('X-Active-Broker', selected);
  next();
};

export default brokerContextMiddleware;

