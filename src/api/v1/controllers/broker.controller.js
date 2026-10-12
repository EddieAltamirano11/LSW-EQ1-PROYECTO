import * as BrokerService from '../services/broker.service.js';

// Consulta de balance, poder de compra y estado de cuenta del broker
export const getAccount = async (req, res, next) => {
  try {
    const acc = await BrokerService.getBrokerAccount();
    res.status(200).json(acc);
  } catch (error) {
    next(error);
  }
};

// Cotización en tiempo real del broker
export const getQuote = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const quote = await BrokerService.getBrokerQuote(symbol);
    res.status(200).json(quote);
  } catch (error) {
    next(error);
  }
};

// Cadena de opciones viva del broker
export const getOptionsChain = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { expiration } = req.query;
    const chain = await BrokerService.getBrokerOptionsChain(symbol, expiration);
    res.status(200).json(chain);
  } catch (error) {
    next(error);
  }
};

// Posiciones abiertas en el broker
export const getPositions = async (req, res, next) => {
  try {
    const positions = await BrokerService.getBrokerPositions();
    res.status(200).json(positions);
  } catch (error) {
    next(error);
  }
};
