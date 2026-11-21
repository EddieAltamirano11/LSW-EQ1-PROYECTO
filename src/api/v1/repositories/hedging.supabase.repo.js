import boom from '@hapi/boom';
import { getSupabaseClient } from '../../../config/supabase.config.js';
import { randomUUID } from 'crypto';

// Columnas reales de tbl_hedging_strategies: id, portfolio_id (uuid), underlying_id (FK a tbl_underlyings), strategy_type,
// shares_count, legs_config (jsonb), financial_metrics (jsonb), status, broker, created_at.
// El símbolo y la compañía se leen de tbl_underlyings por la relación; lo que la tabla no guarda se devuelve null.
const TABLA = 'tbl_hedging_strategies';
const SELECCION = '*, tbl_underlyings(symbol, company_name)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// El portafolio por defecto de la aplicación ('PORT-01' en MongoDB) es esta fila en Supabase, donde portfolio_id es uuid.
const PORTAFOLIO_POR_DEFECTO = 'c0000000-0000-0000-0000-000000000001';
const PORTAFOLIO_POR_DEFECTO_APP = 'PORT-01';
// Datos del subdocumento subyacente que no tienen columna propia (spot de entrada, última sincronización).
const CLAVE_SUBYACENTE = 'underlying';

const esUuid = valor => typeof valor === 'string' && UUID.test(valor);

function portafolioSupabase(portfolioId) {
  if (portfolioId === undefined || portfolioId === null || portfolioId === PORTAFOLIO_POR_DEFECTO_APP) return PORTAFOLIO_POR_DEFECTO;
  if (!esUuid(portfolioId)) throw boom.badRequest(`En Supabase, portfolioId debe ser un UUID o '${PORTAFOLIO_POR_DEFECTO_APP}'.`);
  return portfolioId;
}
const numeroONulo = valor => (valor === null || valor === undefined || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor));

function separarMetricas(metricas = {}) {
  const { [CLAVE_SUBYACENTE]: subyacente = {}, ...resto } = metricas || {};
  return { subyacente: subyacente || {}, metricas: resto };
}

const mapFromSupabase = (row) => {
  if (!row) return null;
  const { subyacente, metricas } = separarMetricas(row.financial_metrics);
  const pataAcciones = (row.legs_config || []).find(l => l.assetType === 'EQUITY' || l.legRole === 'UNDERLYING' || l.role === 'STOCK');
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    broker: row.broker ?? metricas.broker ?? null,
    underlyingId: row.underlying_id,
    strategyType: row.strategy_type,
    status: row.status,
    underlying: {
      ...subyacente,
      symbol: row.tbl_underlyings?.symbol ?? null,
      companyName: row.tbl_underlyings?.company_name ?? null,
      sharesCount: numeroONulo(row.shares_count),
      spotPriceAtEntry: numeroONulo(subyacente.spotPriceAtEntry ?? pataAcciones?.entryPrice ?? pataAcciones?.price),
    },
    legs: row.legs_config || [],
    financialMetrics: metricas,
    createdAt: row.created_at,
  };
};

export class HedgingSupabaseRepository {
  async getAll(filter = {}) {
    const client = getSupabaseClient();
    let query = client.from(TABLA).select(SELECCION).order('created_at', { ascending: false });
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.strategyType) query = query.eq('strategy_type', filter.strategyType);
    if (filter.broker) query = query.eq('broker', filter.broker.toUpperCase());
    if (filter.portfolioId) {
      if (!esUuid(filter.portfolioId) && filter.portfolioId !== PORTAFOLIO_POR_DEFECTO_APP) return [];
      query = query.eq('portfolio_id', portafolioSupabase(filter.portfolioId));
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapFromSupabase);
  }

  async getById(id) {
    if (!esUuid(id)) return null;
    const client = getSupabaseClient();
    const { data, error } = await client.from(TABLA).select(SELECCION).eq('id', id).maybeSingle();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  // Devuelve el id del subyacente registrado; si el símbolo no existe se registra con el spot observado de la estrategia.
  async idDeSubyacente(simbolo, spotObservado) {
    if (!simbolo) throw boom.badRequest('La estrategia debe indicar el símbolo del subyacente (underlying.symbol).');
    const client = getSupabaseClient();
    const sym = String(simbolo).toUpperCase();
    const { data, error } = await client.from('tbl_underlyings').select('id').eq('symbol', sym).limit(1).maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
    const spot = numeroONulo(spotObservado);
    if (!(spot > 0)) {
      throw boom.badRequest(`El subyacente '${sym}' no está registrado y la estrategia no trae un spot observado para registrarlo.`);
    }
    const alta = await client.from('tbl_underlyings').insert([{ id: randomUUID(), symbol: sym, company_name: sym, spot_price: spot }]).select('id').single();
    if (alta.error) throw alta.error;
    return alta.data.id;
  }

  // Permite rechazar un portfolioId incompatible antes de enviar órdenes al broker (el guardado ocurre después).
  validarPortafolio(portfolioId) {
    portafolioSupabase(portfolioId);
  }

  async create(item) {
    const client = getSupabaseClient();
    const id = esUuid(item.id) ? item.id : randomUUID();
    const underlyingId = esUuid(item.underlyingId)
      ? item.underlyingId
      : await this.idDeSubyacente(item.underlying?.symbol, item.underlying?.spotPriceAtEntry);
    const { symbol, companyName, sharesCount, ...extrasSubyacente } = item.underlying || {};
    const broker = item.broker ? String(item.broker).toUpperCase() : null;
    const fila = {
      id,
      portfolio_id: portafolioSupabase(item.portfolioId),
      underlying_id: underlyingId,
      strategy_type: item.strategyType || 'COLLAR',
      shares_count: numeroONulo(sharesCount),
      legs_config: item.legs || [],
      financial_metrics: { ...(item.financialMetrics || {}), broker, [CLAVE_SUBYACENTE]: extrasSubyacente },
      status: item.status || 'ACTIVE',
      broker,
    };
    const { data, error } = await client.from(TABLA).insert([fila]).select(SELECCION).single();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async createBatch(items) {
    const results = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }

  // Traduce los campos de la entidad a columnas reales. Un cuerpo sin campos actualizables es una petición inválida.
  async update(id, updates = {}) {
    if (!esUuid(id)) return null;
    const actual = await this.getById(id);
    if (!actual) return null;
    const fila = {};
    if (updates.status) fila.status = updates.status;
    if (updates.strategyType) fila.strategy_type = updates.strategyType;
    if (updates.broker) fila.broker = String(updates.broker).toUpperCase();
    if (updates.legs) fila.legs_config = updates.legs;
    if (updates.portfolioId !== undefined) fila.portfolio_id = portafolioSupabase(updates.portfolioId);
    if (updates.underlyingId !== undefined) {
      if (!esUuid(updates.underlyingId)) throw boom.badRequest('underlyingId debe ser un UUID de tbl_underlyings.');
      fila.underlying_id = updates.underlyingId;
    }

    const actualRaw = { ...actual.financialMetrics, [CLAVE_SUBYACENTE]: subyacenteGuardado(actual.underlying) };
    let metricas = null;
    if (updates.financialMetrics) metricas = { ...actualRaw, ...updates.financialMetrics, [CLAVE_SUBYACENTE]: actualRaw[CLAVE_SUBYACENTE] };
    if (updates.underlying) {
      const { symbol, companyName, sharesCount, ...extras } = updates.underlying;
      if (symbol && String(symbol).toUpperCase() !== actual.underlying.symbol) {
        fila.underlying_id = await this.idDeSubyacente(symbol, extras.spotPriceAtEntry ?? actual.underlying.spotPriceAtEntry);
      }
      if (sharesCount !== undefined) {
        const acciones = numeroONulo(sharesCount);
        if (!(acciones > 0)) throw boom.badRequest('sharesCount debe ser un número mayor que cero.');
        fila.shares_count = acciones;
      }
      metricas = { ...(metricas || actualRaw), [CLAVE_SUBYACENTE]: { ...actualRaw[CLAVE_SUBYACENTE], ...extras } };
    }
    if (metricas) fila.financial_metrics = metricas;
    if (!Object.keys(fila).length) throw boom.badRequest('La petición no trae campos actualizables de la estrategia.');

    const client = getSupabaseClient();
    const { data, error } = await client.from(TABLA).update(fila).eq('id', id).select(SELECCION).maybeSingle();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async delete(id) {
    if (!esUuid(id)) return null;
    const client = getSupabaseClient();
    const { data, error } = await client.from(TABLA).update({ status: 'CLOSED' }).eq('id', id).select(SELECCION).maybeSingle();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  // === SUBDOCUMENTOS ===
  async getUnderlyingSubdocument(strategyId) {
    const strat = await this.getById(strategyId);
    return strat ? strat.underlying : null;
  }

  async updateUnderlyingSubdocument(strategyId, underlyingUpdates) {
    const strat = await this.update(strategyId, { underlying: underlyingUpdates });
    return strat ? strat.underlying : null;
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
    const strat = await this.update(strategyId, { financialMetrics: metricsUpdates });
    return strat ? strat.financialMetrics : null;
  }
}

// Lo que se guarda en financial_metrics.underlying: todo el subdocumento salvo lo que ya tiene columna o relación.
function subyacenteGuardado(subyacente = {}) {
  const { symbol, companyName, sharesCount, ...extras } = subyacente;
  return extras;
}
