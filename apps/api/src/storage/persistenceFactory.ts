import { LocalFSPersistenceProvider } from './providers/localFsProvider.js';
import { SupabasePersistenceProvider } from './providers/supabaseProvider.js';
import type { PersistenceProvider } from './persistenceProvider.js';

let activeProvider: PersistenceProvider | null = null;

export function getPersistenceProvider(): PersistenceProvider {
  if (activeProvider) return activeProvider;

  const strategy = process.env.STORAGE_STRATEGY || 'supabase';
  console.log(`[PersistenceFactory] 🛠️  Strategy: ${strategy.toUpperCase()}`);

  if (strategy === 'local') {
    activeProvider = new LocalFSPersistenceProvider();
  } else {
    activeProvider = new SupabasePersistenceProvider();
  }

  return activeProvider;
}
