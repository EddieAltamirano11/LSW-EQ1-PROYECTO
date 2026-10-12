import * as HedgingService from '../services/hedging.service.js';
import boom from '@hapi/boom';

// Consulta de piernas embebidas dentro de la estrategia
export const getLegsList = async (req, res, next) => {
  try {
    const { id } = req.params;
    const legs = await HedgingService.getLegsList(id, req.dbTarget);
    res.status(200).json(legs);
  } catch (error) {
    next(error);
  }
};

// Inserción atómica de nueva pierna (Call/Put)
export const addSingleLeg = async (req, res, next) => {
  try {
    const { id } = req.params;
    const legData = req.body;
    if (!legData || !legData.assetType) {
      throw boom.badRequest('El objeto de pierna debe especificar al menos assetType (ej: OPTION, EQUITY).');
    }
    const createdLeg = await HedgingService.addSingleLeg(id, legData, req.dbTarget);
    res.status(201).json({
      message: 'Pierna financiera agregada exitosamente a la estrategia.',
      data: createdLeg,
    });
  } catch (error) {
    next(error);
  }
};

// Obtención de pierna individual por ID embebido
export const getLegById = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const leg = await HedgingService.getLegById(id, legId, req.dbTarget);
    res.status(200).json(leg);
  } catch (error) {
    next(error);
  }
};

// Actualización de strike, prima y parámetros de pierna
export const updateSingleLeg = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const updated = await HedgingService.updateSingleLeg(id, legId, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Pierna financiera actualizada exitosamente.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Ajuste de ratio y ponderación de contratos en la pierna
export const updateLegRatio = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const updated = await HedgingService.updateLegRatio(id, legId, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Ratio y ponderación de la pierna ajustados exitosamente.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Inserción en bloque de múltiples piernas financieras
export const addLegsBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { legs } = req.body;
    const legsArray = Array.isArray(legs) ? legs : req.body;
    if (!Array.isArray(legsArray) || legsArray.length === 0) {
      throw boom.badRequest('El payload debe contener un arreglo no vacío de piernas financieras.');
    }
    const result = await HedgingService.addLegsBatch(id, legsArray, req.dbTarget);
    res.status(201).json({
      message: 'Lote de piernas financieras insertado exitosamente.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Reordenamiento de posiciones de piernas en arreglo
export const reorderLegs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { orderedLegIds } = req.body;
    const ids = Array.isArray(orderedLegIds) ? orderedLegIds : req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw boom.badRequest('Se requiere un arreglo con los identificadores de piernas para reordenar.');
    }
    const reordered = await HedgingService.reorderLegs(id, ids, req.dbTarget);
    res.status(200).json({
      message: 'Posiciones de piernas reordenadas exitosamente.',
      data: reordered,
    });
  } catch (error) {
    next(error);
  }
};

// Eliminación atómica de pierna en arreglo embebido
export const deleteSingleLeg = async (req, res, next) => {
  try {
    const { id, legId } = req.params;
    const deleted = await HedgingService.deleteSingleLeg(id, legId, req.dbTarget);
    res.status(200).json({
      message: 'Pierna financiera eliminada atómicamente de la estrategia.',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

