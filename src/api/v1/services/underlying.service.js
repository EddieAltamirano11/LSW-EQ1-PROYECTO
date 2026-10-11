import boom from '@hapi/boom';
import { getUnderlyingRepo } from '../repositories/underlying.repository.js';

export const listUnderlyings = async (dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  return await repo.getAll();
};

export const getUnderlyingById = async (id, dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  const item = await repo.getById(id);
  if (!item) {
    throw boom.notFound(`No se encontró el activo subyacente con ID '${id}' en ${dbTarget.toUpperCase()}.`);
  }
  return item;
};

export const getUnderlyingBySymbol = async (symbol, dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  const item = await repo.getBySymbol(symbol);
  if (!item) {
    throw boom.notFound(`No se encontró el activo subyacente con ticker '${symbol}' en ${dbTarget.toUpperCase()}.`);
  }
  return item;
};

export const createUnderlying = async (data, dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  const existing = await repo.getBySymbol(data.symbol);
  if (existing) {
    throw boom.conflict(`Ya existe un subyacente registrado con el ticker '${data.symbol.toUpperCase()}'.`);
  }
  return await repo.create(data);
};

export const createUnderlyingsBatch = async (items, dbTarget = 'mongodb') => {
  if (!Array.isArray(items) || items.length === 0) {
    throw boom.badRequest('El cuerpo de la petición debe ser un arreglo no vacío de subyacentes.');
  }
  const repo = getUnderlyingRepo(dbTarget);
  return await repo.createBatch(items);
};

export const updateUnderlying = async (id, data, dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  const updated = await repo.update(id, data);
  if (!updated) {
    throw boom.notFound(`No se encontró el activo subyacente '${id}' para actualizar.`);
  }
  return updated;
};

export const deleteUnderlying = async (id, dbTarget = 'mongodb') => {
  const repo = getUnderlyingRepo(dbTarget);
  const deleted = await repo.delete(id);
  if (!deleted) {
    throw boom.notFound(`No se encontró el activo subyacente '${id}' para eliminar.`);
  }
  return deleted;
};

