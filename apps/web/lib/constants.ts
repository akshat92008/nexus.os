/**
 * Nexus OS — Shared Constants
 * 
 * Central source of truth for environment configurations to prevent 
 * circular dependencies in the module graph.
 */

export const API_BASE = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') : '');
export const IS_CLOUD_MODE = API_BASE.includes('.a.run.app') || API_BASE.includes('nexus-os-cloud');

export const APP_CONFIG = {
  MAX_RETRIES: 8,
  BASE_DELAY: 1000,
  WATCHDOG_INTERVAL: 5000,
  ACTIVITY_TIMEOUT: 15000,
  BRIDGE_VERSION: '1.2.0-beta'
};
