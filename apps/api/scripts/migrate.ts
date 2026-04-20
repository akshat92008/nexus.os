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
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../src/db/migrations');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error('[Migrate] ❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // ── Ensure migrations_log table exists ─────────────────────────────────────
  const { error: tableErr } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS migrations_log (
        id         SERIAL PRIMARY KEY,
        filename   TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  }).maybeSingle();

  // ── Fetch already-applied migrations (Check if table exists) ───────────────────
  const { data: applied, error: fetchErr } = await supabase
    .from('migrations_log')
    .select('filename');

  if (fetchErr) {
    if (fetchErr.message.includes('not found') || fetchErr.code === '42P01') {
      console.error('\n[Migrate] ❌ Database infrastructure not initialized.');
      console.error('──────────────────────────────────────────────────');
      console.error('To fix this, please run the following SQL in your Supabase SQL Editor:');
      console.error('\n-- 1. Create tracking table');
      console.error('CREATE TABLE IF NOT EXISTS migrations_log (id SERIAL PRIMARY KEY, filename TEXT NOT NULL UNIQUE, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());');
      console.error('\n-- 2. Create RPC helper');
      console.error('CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE sql; END; $$;');
      console.error('──────────────────────────────────────────────────\n');
    } else {
      console.error('[Migrate] ❌ Unexpected Error Reading migrations_log:', fetchErr.message);
    }
    process.exit(1);
  }

  const appliedSet = new Set((applied ?? []).map((r: { filename: string }) => r.filename));

  // ── Read migration files ─────────────────────────────────────────────────────
  let files: string[];
  try {
    files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort(); // lexicographic order → 001_, 002_, 003_
  } catch {
    console.error(`[Migrate] ❌ Could not read migrations directory: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const pending = files.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log('[Migrate] ✅ No pending migrations — database is up to date');
    return;
  }

  console.log(`[Migrate] Found ${pending.length} pending migration(s):`);
  pending.forEach((f) => console.log(`          • ${f}`));

  // ── Run pending migrations ───────────────────────────────────────────────────
  for (const filename of pending) {
    const filePath = join(MIGRATIONS_DIR, filename);
    const sql = await readFile(filePath, 'utf8');

    console.log(`\n[Migrate] ▶ Running ${filename}...`);

    // Execute via Supabase SQL (uses service key — full privileges)
    const { error: runErr } = await supabase.rpc('exec_sql', { sql }).maybeSingle();

    if (runErr) {
      console.error(`[Migrate] ❌ Failed on ${filename}:`, runErr.message);
      console.error('          Halting — fix the migration and re-run');
      process.exit(1);
    }

    // Record success
    const { error: logErr } = await supabase
      .from('migrations_log')
      .insert({ filename });

    if (logErr) {
      console.error(`[Migrate] ⚠️  Migration ran but failed to log ${filename}:`, logErr.message);
      // Don't exit — the migration succeeded; logging failure is non-fatal
    }

    console.log(`[Migrate] ✅ ${filename} applied`);
  }

  console.log('\n[Migrate] 🎉 All migrations applied successfully');
}

main().catch((err) => {
  console.error('[Migrate] Unexpected error:', err);
  process.exit(1);
});
