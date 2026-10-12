import { HedgingMongoRepository } from './hedging.mongo.repo.js';
import { HedgingSupabaseRepository } from './hedging.supabase.repo.js';

const mongoRepo = new HedgingMongoRepository();
const supabaseRepo = new HedgingSupabaseRepository();

export const getHedgingRepo = (dbTarget = 'mongodb') => {
  return dbTarget === 'supabase' ? supabaseRepo : mongoRepo;
};

