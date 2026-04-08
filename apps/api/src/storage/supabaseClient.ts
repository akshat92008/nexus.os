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

  if (!url || !key) {
    throw new Error('[SupabaseClient] Credentials missing (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
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
