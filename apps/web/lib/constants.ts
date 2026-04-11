/**
 * Nexus OS — Shared Constants
 * 
 * Central source of truth for environment configurations to prevent 
 * circular dependencies in the module graph.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006';

export const APP_CONFIG = {
  MAX_RETRIES: 8,
  BASE_DELAY: 1000,
  WATCHDOG_INTERVAL: 5000,
  ACTIVITY_TIMEOUT: 15000,
};
