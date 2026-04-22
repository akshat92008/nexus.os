/**
 * Nexus OS — Supabase Client Singleton
 *
 * Provides a central, asynchronous accessor for the Supabase service client.
 */

let supabaseClient: any = null;

export async function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const strategy = process.env.STORAGE_STRATEGY || 'supabase';

  if (strategy !== 'local' && (!url || !key)) {
    throw new Error('[SupabaseClient] Credentials missing (SUPABASE_URL / SUPABASE_SERVICE_KEY). Set STORAGE_STRATEGY=local to skip cloud dependency.');
  }

  // If in local mode without credentials, return a proxy that throws if someone tries to use it in local mode
  if (strategy === 'local' && (!url || !key)) {
    console.log('[SupabaseClient] 🛡️  Running in LOCAL-ONLY mode (Bypassing cloud handshake)');
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
    console.error('[SupabaseClient] Initialization failed:', err);
    throw err;
  }
}
