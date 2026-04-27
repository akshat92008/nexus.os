/**
 * Nexus OS — Supabase Client Singleton
 *
 * Provides a central, asynchronous accessor for the Supabase service client.
 */
import { env } from '../config/env.js';
import { logger } from '../logger.js';

let supabaseClient: any = null;

export async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key, STORAGE_STRATEGY: strategy } = env;

  if (strategy !== 'local' && (!url || !key)) {
    throw new Error('[SupabaseClient] Credentials missing (SUPABASE_URL / SUPABASE_SERVICE_KEY). Set STORAGE_STRATEGY=local to skip cloud dependency.');
  }

  // If in local mode without credentials, return a proxy that throws if someone tries to use it in local mode
  if (strategy === 'local' && (!url || !key)) {
    logger.warn('[SupabaseClient] Running in LOCAL-ONLY mode');
    return new Proxy({}, {
      get: () => {
        throw new Error('[SupabaseClient] Attempted cloud access in LOCAL mode. Check your PersistenceProvider logic.');
      }
    });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient;
  } catch (err) {
    logger.error({ err }, '[SupabaseClient] Initialization failed');
    throw err;
  }
}
