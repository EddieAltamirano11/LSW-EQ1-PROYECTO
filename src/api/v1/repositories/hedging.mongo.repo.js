import HedgingStrategy from '../models/HedgingStrategy.model.js';
import { randomUUID } from 'crypto';

export class HedgingMongoRepository {
  // === ESTRATEGIA PRINCIPAL ===
  async getAll(filter = {}) {
    const query = { deletedAt: null, ...filter };
    return await HedgingStrategy.find(query).sort({ createdAt: -1 });
  }

  async getById(id) {
    return await HedgingStrategy.findOne({
      $or: [{ _id: id }, { portfolioId: id }],
      deletedAt: null,
    }).sort({ createdAt: -1 });
  }

  async create(data) {
    const id = data.id || data._id || `STRAT-${data.strategyType}-${randomUUID().slice(0, 6)}`;
    const newDoc = new HedgingStrategy({ ...data, _id: id });
    return await newDoc.save();
  }

  async createBatch(items) {
    const docs = items.map((item) => ({
      ...item,
      _id: item.id || item._id || `STRAT-${item.strategyType}-${randomUUID().slice(0, 6)}`,
    }));
    return await HedgingStrategy.insertMany(docs);
  }

  async update(id, updates) {
    return await HedgingStrategy.findOneAndUpdate(
      { $or: [{ _id: id }, { portfolioId: id }], deletedAt: null },
      { $set: updates },
      { new: true, runValidators: true }
    );
  }

  async delete(id) {
    return await HedgingStrategy.findOneAndUpdate(
      { $or: [{ _id: id }, { portfolioId: id }], deletedAt: null },
      { $set: { deletedAt: new Date(), status: 'CLOSED' } },
      { new: true }
    );
  }

  // === SUBDOCUMENTO: UNDERLYING ===
  async getUnderlyingSubdocument(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.underlying : null;
  }

  async updateUnderlyingSubdocument(strategyId, underlyingUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    strat.underlying = { ...strat.underlying.toObject(), ...underlyingUpdates };
    return await strat.save();
  }

  // === SUBDOCUMENTO: LEGS (ARREGLO DE OBJETOS) ===
  async getAllLegs(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.legs : null;
  }

  async getLegById(strategyId, legId) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    return strat.legs.find((l) => l.legId === legId) || null;
  }

  async addLeg(strategyId, legData) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const legId = legData.legId || `LEG-${randomUUID().slice(0, 6)}`;
    strat.legs.push({ ...legData, legId });
    await strat.save();
    return strat.legs.find((l) => l.legId === legId);
  }

  async addLegsBatch(strategyId, legsArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const prepared = legsArray.map((l) => ({
      ...l,
      legId: l.legId || `LEG-${randomUUID().slice(0, 6)}`,
    }));
    strat.legs.push(...prepared);
    await strat.save();
    return strat.legs;
  }

  async updateLeg(strategyId, legId, legUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const leg = strat.legs.find((l) => l.legId === legId);
    if (!leg) return null;
    Object.assign(leg, legUpdates);
    await strat.save();
    return leg;
  }

  async updateLegsBatch(strategyId, updatesArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    let modifiedCount = 0;
    for (const update of updatesArray) {
      const leg = strat.legs.find((l) => l.legId === update.legId);
      if (leg) {
        Object.assign(leg, update);
        modifiedCount++;
      }
    }
    await strat.save();
    return { modifiedCount, legs: strat.legs };
  }

  async deleteLeg(strategyId, legId) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const initialLen = strat.legs.length;
    strat.legs = strat.legs.filter((l) => l.legId !== legId);
    if (strat.legs.length === initialLen) return null;
    await strat.save();
    return { deletedLegId: legId, remainingCount: strat.legs.length };
  }

  async deleteLegsBatch(strategyId, legIdsArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const initialLen = strat.legs.length;
    strat.legs = strat.legs.filter((l) => !legIdsArray.includes(l.legId));
    await strat.save();
    return { deletedCount: initialLen - strat.legs.length, remainingCount: strat.legs.length };
  }

  // === SUBDOCUMENTO: FINANCIAL METRICS ===
  async getMetrics(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.financialMetrics : null;
  }

  async updateMetrics(strategyId, metricsUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    strat.financialMetrics = { ...strat.financialMetrics.toObject(), ...metricsUpdates };
    await strat.save();
    return strat.financialMetrics;
  }
}

