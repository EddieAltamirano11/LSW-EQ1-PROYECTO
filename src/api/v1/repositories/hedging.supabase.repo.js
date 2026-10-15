import { getSupabaseClient } from '../../../config/supabase.config.js';
import { randomUUID } from 'crypto';

const mapFromSupabase = (row) => {
  if (!row) return null;
  const stockLeg = row.legs_config?.find((l) => l.assetType === 'EQUITY' || l.legRole === 'UNDERLYING');
  const sym = stockLeg?.legId?.split('-')?.[1] || 'NVDA';
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    broker: row.broker || row.financial_metrics?.broker || 'ALPACA',
    underlyingId: row.underlying_id,
    strategyType: row.strategy_type,
    status: row.status,
    underlying: {
      symbol: sym,
      sharesCount: row.shares_count || 10,
      spotPriceAtEntry: stockLeg?.entryPrice || 125.80,
    },
    legs: row.legs_config || [],
    financialMetrics: row.financial_metrics || {},
    createdAt: row.created_at,
  };
};

export class HedgingSupabaseRepository {
  async getAll() {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tbl_hedging_strategies').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFromSupabase);
  }

  async getById(id) {
    const client = getSupabaseClient();
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    const { data, error } = await client.from('tbl_hedging_strategies').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return mapFromSupabase(data);
  }

  async create(item) {
    const client = getSupabaseClient();
    const id = (item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)) ? item.id : randomUUID();

    let uId = item.underlyingId;
    if (!uId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uId)) {
      const sym = item.underlying?.symbol || 'NVDA';
      const { data: uData } = await client.from('tbl_underlyings').select('id').eq('symbol', sym.toUpperCase()).limit(1).single();
      uId = uData?.id || '59bda817-45ca-4d52-a93f-16edc675f2ef';
    }

    const brokerValue = item.broker || 'WEBULL';
    const baseRow = {
      id,
      portfolio_id: (item.portfolioId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.portfolioId)) ? item.portfolioId : 'c0000000-0000-0000-0000-000000000001',
      underlying_id: uId,
      strategy_type: item.strategyType || 'COLLAR',
      shares_count: item.underlying?.sharesCount || 100,
      legs_config: item.legs || [],
      financial_metrics: {
        ...(item.financialMetrics || {}),
        broker: brokerValue,
      },
      status: item.status || 'ACTIVE',
    };

    // Intenta insertar con la columna física 'broker'; si la columna aún no existe en PostgreSQL, inserta con fallback a JSONB
    let res = await client.from('tbl_hedging_strategies').insert([{ ...baseRow, broker: brokerValue }]).select().single();
    if (res.error && res.error.message && res.error.message.includes('broker')) {
      res = await client.from('tbl_hedging_strategies').insert([baseRow]).select().single();
    }
    if (res.error) throw res.error;
    return mapFromSupabase(res.data);
  }

  async createBatch(items) {
    const results = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }

  async update(id, updates) {
    const client = getSupabaseClient();
    const rowUpdates = {};
    if (updates.status) rowUpdates.status = updates.status;
    if (updates.underlying) rowUpdates.underlying_data = updates.underlying;
    if (updates.legs) rowUpdates.legs_config = updates.legs;
    if (updates.financialMetrics) rowUpdates.financial_metrics = updates.financialMetrics;

    const { data, error } = await client
      .from('tbl_hedging_strategies')
      .update(rowUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async delete(id) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tbl_hedging_strategies')
      .update({ status: 'CLOSED' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  // === SUBDOCUMENTOS ===
  async getUnderlyingSubdocument(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.underlying : null;
  }

  async updateUnderlyingSubdocument(strategyId, underlyingUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const merged = { ...strat.underlying, ...underlyingUpdates };
    return await this.update(strategyId, { underlying: merged });
  }

  async getAllLegs(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.legs : null;
  }

  async getLegById(strategyId, legId) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    return (strat.legs || []).find((l) => l.legId === legId || l.role === legId) || null;
  }

  async addLeg(strategyId, legData) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const legId = legData.legId || `LEG-${randomUUID().slice(0, 6)}`;
    const newLeg = { ...legData, legId };
    const currentLegs = [...(strat.legs || []), newLeg];
    await this.update(strategyId, { legs: currentLegs });
    return newLeg;
  }

  async addLegsBatch(strategyId, legsArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const prepared = legsArray.map((l) => ({ ...l, legId: l.legId || `LEG-${randomUUID().slice(0, 6)}` }));
    const currentLegs = [...(strat.legs || []), ...prepared];
    await this.update(strategyId, { legs: currentLegs });
    return currentLegs;
  }

  async updateLeg(strategyId, legId, legUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    let found = false;
    const currentLegs = (strat.legs || []).map((l) => {
      if (l.legId === legId || l.role === legId) {
        found = true;
        return { ...l, ...legUpdates };
      }
      return l;
    });
    if (!found) return null;
    await this.update(strategyId, { legs: currentLegs });
    return currentLegs.find((l) => l.legId === legId || l.role === legId);
  }

  async updateLegsBatch(strategyId, updatesArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const updateMap = new Map(updatesArray.map((u) => [u.legId, u]));
    let modifiedCount = 0;
    const currentLegs = (strat.legs || []).map((l) => {
      if (updateMap.has(l.legId)) {
        modifiedCount++;
        return { ...l, ...updateMap.get(l.legId) };
      }
      return l;
    });
    await this.update(strategyId, { legs: currentLegs });
    return { modifiedCount, legs: currentLegs };
  }

  async deleteLeg(strategyId, legId) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const initialLen = (strat.legs || []).length;
    const filtered = (strat.legs || []).filter((l) => l.legId !== legId && l.role !== legId);
    if (filtered.length === initialLen) return null;
    await this.update(strategyId, { legs: filtered });
    return { deletedLegId: legId, remainingCount: filtered.length };
  }

  async deleteLegsBatch(strategyId, legIdsArray) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const initialLen = (strat.legs || []).length;
    const filtered = (strat.legs || []).filter((l) => !legIdsArray.includes(l.legId));
    await this.update(strategyId, { legs: filtered });
    return { deletedCount: initialLen - filtered.length, remainingCount: filtered.length };
  }

  async getMetrics(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.financialMetrics : null;
  }

  async updateMetrics(strategyId, metricsUpdates) {
    const strat = await this.getById(strategyId);
    if (!strat) return null;
    const merged = { ...strat.financialMetrics, ...metricsUpdates };
    await this.update(strategyId, { financialMetrics: merged });
    return merged;
  }
}

