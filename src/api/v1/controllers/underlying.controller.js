import * as UnderlyingService from '../services/underlying.service.js';

export const getAllUnderlyings = async (req, res, next) => {
  try {
    const list = await UnderlyingService.listUnderlyings(req.dbTarget);
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

export const getUnderlyingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await UnderlyingService.getUnderlyingById(id, req.dbTarget);
    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

export const getUnderlyingBySymbol = async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const item = await UnderlyingService.getUnderlyingBySymbol(symbol, req.dbTarget);
    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

export const createUnderlying = async (req, res, next) => {
  try {
    const created = await UnderlyingService.createUnderlying(req.body, req.dbTarget);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const createUnderlyingsBatch = async (req, res, next) => {
  try {
    const created = await UnderlyingService.createUnderlyingsBatch(req.body, req.dbTarget);
    res.status(201).json({
      message: 'Lote de activos subyacentes insertado exitosamente.',
      count: created.length,
      records: created,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUnderlying = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await UnderlyingService.updateUnderlying(id, req.body, req.dbTarget);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteUnderlying = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await UnderlyingService.deleteUnderlying(id, req.dbTarget);
    res.status(200).json({
      message: 'Activo subyacente eliminado lógicamente.',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

