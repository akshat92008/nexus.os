// apps/api/src/config/env.ts
// Validated, typed environment configuration.
// Throws at startup if required vars are missing — no silent failures in production.

import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(
      `[ENV] Missing required environment variable: "${key}"\n` +
      `      Add it to your .env file. See apps/api/.env.example for reference.`
    );
  }
  return val;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue;
}

function requiredInProd(key: string): string {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(
      `[ENV] "${key}" is required in production. Set it in your deployment environment.`
    );
  }
  return val || '';
}

export const env = {
  // ── Runtime ──────────────────────────────────────────────────────────────
  NODE_ENV:             optional('NODE_ENV', 'development'),
  PORT:                 optional('PORT', '3006'),

  // ── Supabase (required always) ──────────────────────────────────────────
  SUPABASE_URL:         required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: required('SUPABASE_SERVICE_KEY'),
  SUPABASE_ANON_KEY:    optional('SUPABASE_ANON_KEY'),

  // ── AI Providers ────────────────────────────────────────────────────────
  GROQ_API_KEY:         required('GROQ_API_KEY'),
  OPENROUTER_API_KEY:   optional('OPENROUTER_API_KEY'),
  GEMINI_API_KEY:       optional('GEMINI_API_KEY'),
  NVIDIA_API_KEY:       optional('NVIDIA_API_KEY'),

  // ── Email ───────────────────────────────────────────────────────────────
  SENDGRID_API_KEY:     optional('SENDGRID_API_KEY'),
  RESEND_API_KEY:       optional('RESEND_API_KEY'),
  EMAIL_FROM_ADDRESS:   requiredInProd('EMAIL_FROM_ADDRESS') ||
                        optional('EMAIL_FROM_ADDRESS', 'dev@localhost.dev'),
  EMAIL_FROM_NAME:      optional('EMAIL_FROM_NAME', 'Nexus OS'),

  // ── CORS ────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS:      optional('ALLOWED_ORIGINS', 'http://localhost:3000'),

  // ── Feature flags ───────────────────────────────────────────────────────
  USE_AI_PROXY:         process.env.USE_AI_PROXY === 'true',
  STORAGE_STRATEGY:     optional('STORAGE_STRATEGY', 'supabase'),

  // ── Optional infra ──────────────────────────────────────────────────────
  REDIS_URL:            optional('REDIS_URL'),
  E2B_API_KEY:          optional('E2B_API_KEY'),
  SERPER_API_KEY:       optional('SERPER_API_KEY'),
  TAVILY_API_KEY:       optional('TAVILY_API_KEY'),
};
