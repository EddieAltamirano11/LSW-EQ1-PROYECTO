import { createClient } from '@supabase/supabase-js';
import config from './config.js';

let supabaseClient = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error('[Supabase] SUPABASE_URL o SUPABASE_ANON_KEY no estan configuradas en .env');
    }
    supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    });
  }
  return supabaseClient;
};

export const testSupabaseConnection = async () => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('tbl_underlyings').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('[Supabase Cloud] Conectado exitosamente y tabla tbl_underlyings accesible.');
    return 'CONNECTED';
  } catch (error) {
    console.error(`[Supabase Cloud] Error al conectar: ${error.message}`);
    return 'ERROR';
  }
};
