import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '../db/migrations');

export async function runMigrations() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('[Migrate] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }

  const supabase = createClient(url, key);

  await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS migrations_log (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  }).maybeSingle();

  const { data: applied, error: fetchErr } = await supabase
    .from('migrations_log')
    .select('filename');

  if (fetchErr) {
    throw new Error(`[Migrate] Unable to read migrations_log: ${fetchErr.message}`);
  }

  const appliedSet = new Set((applied ?? []).map((row: { filename: string }) => row.filename));
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  for (const filename of files.filter((file) => !appliedSet.has(file))) {
    const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
    const { error: runErr } = await supabase.rpc('exec_sql', { sql }).maybeSingle();
    if (runErr) {
      throw new Error(`[Migrate] Failed on ${filename}: ${runErr.message}`);
    }

    await supabase.from('migrations_log').insert({ filename });
  }
}

