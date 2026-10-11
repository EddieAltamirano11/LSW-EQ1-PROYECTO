import { UnderlyingMongoRepository } from './underlying.mongo.repo.js';
import { UnderlyingSupabaseRepository } from './underlying.supabase.repo.js';

const mongoRepo = new UnderlyingMongoRepository();
const supabaseRepo = new UnderlyingSupabaseRepository();

export const getUnderlyingRepo = (dbTarget = 'mongodb') => {
  return dbTarget === 'supabase' ? supabaseRepo : mongoRepo;
};

