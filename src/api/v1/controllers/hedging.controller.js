import * as HedgingService from '../services/hedging.service.js';

// === ESTRATEGIAS PRINCIPALES ===
export const listStrategies = async (req, res, next) => {
  try {
    const list = await HedgingService.listStrategies(req.query, req.dbTarget);
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

export const getStrategyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await HedgingService.getStrategyById(id, req.dbTarget);
    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

export const createProtectivePut = async (req, res, next) => {
  try {
    const created = await HedgingService.createProtectivePut(req.body, req.dbTarget);
    res.status(201).json({
      message: 'Estrategia Protective Put estructurada y emitida exitosamente.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

export const createCollarSpread = async (req, res, next) => {
  try {
    const created = await HedgingService.createCollarSpread(req.body, req.dbTarget);
    res.status(201).json({
      message: 'Estrategia Zero-Cost Collar calibrada y creada exitosamente.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

export const autoCalibrateCollar = async (req, res, next) => {
  try {
    const symbol = req.params.symbol || req.body.symbol;
    const broker = req.body?.broker || req.query?.broker || req.broker;
    const executeOrdersRaw = req.body?.executeOrders ?? req.query?.executeOrders ?? req.body?.executeOnBroker ?? false;
    const executeOrders = executeOrdersRaw === true || executeOrdersRaw === 'true' || executeOrdersRaw === 1;

    const result = await HedgingService.autoCalibrateAndCreateCollar({
      ...req.body,
      symbol,
      broker,
      executeOrders,
    }, req.dbTarget);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const recommendOption = async (req, res, next) => {
  try {
    const symbol = req.params.symbol || req.query.symbol;
    const type = req.query.type || req.params.type || req.body?.type || 'PUT';
    const broker = req.body?.broker || req.query?.broker || req.broker;
    const expirationDate = req.query.expiration || req.query.expirationDate || '2026-10-16';
    const moneyness = req.query.moneyness || 'OTM';
    const volatility = req.query.volatility ? Number(req.query.volatility) : undefined;

    const result = await HedgingService.recommendOption({
      symbol,
      type,
      broker,
      expirationDate,
      moneyness,
      volatility,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const recommendCollar = recommendOption;

export const createStrategiesBatch = async (req, res, next) => {
  try {
    const created = await HedgingService.createStrategiesBatch(req.body, req.dbTarget);
    res.status(201).json({
      message: 'Lote de estrategias registrado exitosamente.',
      count: created.length,
      records: created,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStrategyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await HedgingService.updateStrategyStatus(id, status, req.dbTarget);
    res.status(200).json({
      message: 'Estado de la estrategia actualizado.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStrategy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await HedgingService.deleteStrategy(id, req.dbTarget);
    res.status(200).json({
      message: 'Estrategia cerrada/eliminada lógicamente.',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

// === SUBDOCUMENTO: UNDERLYING ===
export const getUnderlyingSub = async (req, res, next) => {
  try {
    const { id } = req.params;
    const underlying = await HedgingService.getUnderlyingSub(id, req.dbTarget);
    res.status(200).json(underlying);
  } catch (error) {
    next(error);
  }
};

export const updateUnderlyingSub = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await HedgingService.updateUnderlyingSub(id, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Subdocumento subyacente actualizado.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// === SUBDOCUMENTO: LEGS (CRUD COMPLETO) ===
export const getLegsList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const legs = await HedgingService.getLegsList(id, req.dbTarget);
    res.status(200).json(legs);
  } catch (error) {
    next(error);
  }
};

export const getLegById = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const leg = await HedgingService.getLegById(id, legId, req.dbTarget);
    res.status(200).json(leg);
  } catch (error) {
    next(error);
  }
};

export const addSingleLeg = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leg = await HedgingService.addSingleLeg(id, req.body, req.dbTarget);
    res.status(201).json({
      message: 'Pata individual agregada exitosamente a la estrategia.',
      leg,
    });
  } catch (error) {
    next(error);
  }
};

export const addLegsBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const legs = await HedgingService.addLegsBatch(id, req.body, req.dbTarget);
    res.status(201).json({
      message: 'Lote de patas agregado a la estrategia.',
      legs,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSingleLeg = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const updated = await HedgingService.updateSingleLeg(id, legId, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Pata actualizada.',
      leg: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLegsBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await HedgingService.updateLegsBatch(id, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Patas actualizadas en bloque.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSingleLeg = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const result = await HedgingService.deleteSingleLeg(id, legId, req.dbTarget);
    res.status(200).json({
      message: 'Pata eliminada del arreglo legs.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLegsBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { legIds } = req.body;
    const result = await HedgingService.deleteLegsBatch(id, legIds, req.dbTarget);
    res.status(200).json({
      message: 'Lote de patas eliminado.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// === SUBDOCUMENTO: METRICS & PAYOFF ===
export const getStrategyMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const metrics = await HedgingService.getStrategyMetrics(id, req.dbTarget);
    res.status(200).json(metrics);
  } catch (error) {
    next(error);
  }
};

export const recalculateMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await HedgingService.recalculateMetrics(id, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Métricas analíticas recalculadas exitosamente.',
      financialMetrics: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getPayoffMatrix = async (req, res, next) => {
  try {
    const { id } = req.params;
    const matrix = await HedgingService.generatePayoffMatrix(id, req.query, req.dbTarget);
    res.status(200).json(matrix);
  } catch (error) {
    next(error);
  }
};

