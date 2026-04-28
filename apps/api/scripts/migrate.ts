/**
 * Nexus OS — Database Migration Runner
 *
 * Usage:  pnpm migrate
 *
 * - Reads all *.sql files from src/db/migrations/ in filename order
 * - Checks a migrations_log table in Supabase for already-run migrations
 * - Runs only new migrations, recording each in migrations_log on success
 * - Exits 0 on success, 1 on any failure
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { runMigrations } from '../src/scripts/migrate.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations().catch((err) => {
    console.error('[Migrate] Unexpected error:', err);
    process.exit(1);
  });
}
