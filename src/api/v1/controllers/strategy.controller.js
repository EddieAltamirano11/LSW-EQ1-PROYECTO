import * as HedgingService from '../services/hedging.service.js';
import { getHedgingRepo } from '../repositories/hedging.repository.js';
import boom from '@hapi/boom';

// Listar estrategias con filtros opcionales (status, portfolioId, strategyType)
export const getAllStrategies = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status.toUpperCase();
    if (req.query.portfolioId) filter.portfolioId = req.query.portfolioId;
    if (req.query.strategyType) filter.strategyType = req.query.strategyType.toUpperCase();

    const strategies = await HedgingService.listStrategies(filter, req.dbTarget);
    res.status(200).json(strategies);
  } catch (error) {
    next(error);
  }
};

// Obtener estrategia por ID
export const getStrategyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await HedgingService.getStrategyById(id, req.dbTarget);
    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

// Crear estrategia base con subdocumento underlying
export const createStrategy = async (req, res, next) => {
  try {
    const { portfolioId, strategyType, underlying, legs = [], financialMetrics } = req.body;
    if (!portfolioId || !strategyType) {
      throw boom.badRequest('portfolioId y strategyType son requeridos.');
    }
    if (!underlying || !underlying.symbol || !underlying.spotPriceAtEntry) {
      throw boom.badRequest('El subdocumento underlying debe contener al menos symbol y spotPriceAtEntry.');
    }

    const repo = getHedgingRepo(req.dbTarget);
    const newDoc = {
      portfolioId,
      strategyType: strategyType.toUpperCase(),
      status: 'ACTIVE',
      underlying: {
        symbol: underlying.symbol.toUpperCase(),
        companyName: underlying.companyName || `${underlying.symbol.toUpperCase()} Corp`,
        spotPriceAtEntry: Number(underlying.spotPriceAtEntry),
        sharesCount: Number(underlying.sharesCount || 100),
      },
      legs: legs || [],
      financialMetrics: financialMetrics || {
        netDebitCredit: 0,
        breakevenPrice: Number(underlying.spotPriceAtEntry),
        floorProtectionPrice: 0,
        maxLossTotalUSD: 0,
        netDelta: 1.0,
      },
    };

    const created = await repo.create(newDoc);
    res.status(201).json({
      message: 'Estrategia de cobertura registrada exitosamente.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

// Crear Collar Spread manual estructurado
export const createCollarSpread = async (req, res, next) => {
  try {
    const created = await HedgingService.createCollarSpread(req.body, req.dbTarget);
    res.status(201).json({
      message: 'Collar Spread estructurado exitosamente con piernas Call y Put.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar parámetros estructurales de la estrategia
export const updateStrategy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await HedgingService.updateStrategy(id, req.body, req.dbTarget);
    res.status(200).json({
      message: 'Estrategia de cobertura actualizada exitosamente.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Transición de estado de ciclo de vida (ACTIVE, CLOSED, EXPIRED)
export const updateStrategyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      throw boom.badRequest('El campo status es requerido.');
    }
    const updated = await HedgingService.updateStrategyStatus(id, status.toUpperCase(), req.dbTarget);
    res.status(200).json({
      message: 'Estado de la estrategia actualizado exitosamente.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Eliminación lógica de la estrategia
export const deleteStrategy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await HedgingService.deleteStrategy(id, req.dbTarget);
    res.status(200).json({
      message: 'Estrategia de cobertura eliminada lógicamente.',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

