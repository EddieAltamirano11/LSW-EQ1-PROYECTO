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

// Historial y listado de órdenes bursátiles
export const getOrders = async (req, res, next) => {
  try {
    const { status = 'all' } = req.query;
    const orders = await BrokerService.getBrokerOrders(status);
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

// Emisión y ejecución de orden bursátil (mercado/límite)
export const createOrder = async (req, res, next) => {
  try {
    const result = await BrokerService.createBrokerOrder(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// Cancelación de orden bursátil
export const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await BrokerService.cancelBrokerOrder(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Sincronizar y actualizar precio spot del subyacente en BD con datos del Broker
export const syncUnderlying = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const result = await BrokerService.syncUnderlyingFromBroker(symbol, req.dbTarget);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};


