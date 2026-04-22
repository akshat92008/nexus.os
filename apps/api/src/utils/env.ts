/**
 * Centralized Environment & Feature Flag Utilities
 */
import { logger } from '../logger.js';

/**
 * Checks if Redis is correctly configured for the current environment.
 * Prevents "Connection Closed" spam in Cloud environments (like Cloud Run) 
 * when REDIS_URL is still pointing to localhost.
 */
export function isRedisAvailable(): boolean {
  const url = process.env.REDIS_URL;
  const isProd = process.env.NODE_ENV === 'production';

  if (!url) {
    return false;
  }

  // Detection logic for local vs cloud mismatch
  const isLocalHost = url.includes('localhost') || url.includes('127.0.0.1');

  if (isProd && isLocalHost) {
    logger.error(
      '⚠️ [ENV CHECK] Infrastructure Mismatch Detected!\n' +
      '  - Current Environment: PRODUCTION\n' +
      '  - Redis URL: ' + url + '\n' +
      '  - Status: Redis is DISABLED to prevent connection errors.\n' +
      '  - Fix: Update your Cloud environment variables or GitHub Secrets with a real Redis URL (e.g., Upstash or Memorystore).'
    );
    return false;
  }

  return true;
}
