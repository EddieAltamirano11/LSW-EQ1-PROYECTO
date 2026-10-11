import { getSupabaseClient } from '../../../config/supabase.config.js';
import { randomUUID } from 'crypto';

const mapFromSupabase = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    companyName: row.company_name,
    spotPrice: Number(row.spot_price),
    volatility: Number(row.volatility || 0.2),
    sector: row.sector || 'FINANCIAL',
    createdAt: row.created_at,
  };
};

export class UnderlyingSupabaseRepository {
  async getAll() {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tbl_underlyings').select('*').order('symbol');
    if (error) throw error;
    return (data || []).map(mapFromSupabase);
  }

  async getById(id) {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tbl_underlyings').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return mapFromSupabase(data);
  }

  async getBySymbol(symbol) {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tbl_underlyings')
      .select('*')
      .ilike('symbol', symbol)
      .maybeSingle();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async create(item) {
    const client = getSupabaseClient();
    const row = {
      id: item.id && item.id.includes('-') && item.id.length === 36 ? item.id : randomUUID(),
      symbol: item.symbol.toUpperCase(),
      company_name: item.companyName || item.company_name,
      spot_price: item.spotPrice || item.spot_price,
      volatility: item.volatility ?? 0.2,
    };
    const { data, error } = await client.from('tbl_underlyings').insert([row]).select().single();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async createBatch(items) {
    const client = getSupabaseClient();
    const rows = items.map((item) => ({
      id: item.id && item.id.includes('-') && item.id.length === 36 ? item.id : randomUUID(),
      symbol: item.symbol.toUpperCase(),
      company_name: item.companyName || item.company_name,
      spot_price: item.spotPrice || item.spot_price,
      volatility: item.volatility ?? 0.2,
    }));
    const { data, error } = await client.from('tbl_underlyings').insert(rows).select();
    if (error) throw error;
    return (data || []).map(mapFromSupabase);
  }

  async update(id, updates) {
    const client = getSupabaseClient();
    const rowUpdates = {};
    if (updates.companyName) rowUpdates.company_name = updates.companyName;
    if (updates.spotPrice) rowUpdates.spot_price = updates.spotPrice;
    if (updates.volatility !== undefined) rowUpdates.volatility = updates.volatility;

    const { data, error } = await client
      .from('tbl_underlyings')
      .update(rowUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapFromSupabase(data);
  }

  async delete(id) {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tbl_underlyings').delete().eq('id', id).select().single();
    if (error) throw error;
    return mapFromSupabase(data);
  }
}

