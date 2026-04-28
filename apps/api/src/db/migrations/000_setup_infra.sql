-- Pre-Migration: Infrastructure Setup
-- ──────────────────────────────────────────────────
-- Run this manually in the Supabase SQL Editor if 'pnpm migrate' fails.

-- 1. Migration tracking table
CREATE TABLE IF NOT EXISTS migrations_log (
    id         SERIAL PRIMARY KEY,
    filename   TEXT        NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. SQL Execution Helper (Required for RPC migrations)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
