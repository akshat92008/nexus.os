/**
 * Nexus OS — Redis Client
 *
 * Fixes applied:
 *  - Throws a clear error if REDIS_URL is missing (no silent null return)
 *  - Retry logic: 3 retries with 1-second delay between each
 *  - Exposes getRedis() for optional use (returns null only if REDIS_URL absent)
 *  - Exposes getRedisOrThrow() for callers that require Redis
 */

import Redis from 'ioredis';

let client: Redis | null = null;

const MAX_RETRIES  = 3;
const RETRY_DELAY  = 1000; // ms

function buildClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: MAX_RETRIES,
    retryStrategy(times: number) {
      if (times > MAX_RETRIES) return null; // stop retrying
      return RETRY_DELAY;
    },
    enableReadyCheck:  true,
    lazyConnect:       false,
  });
}

/**
 * Returns a Redis client if REDIS_URL is set, or null otherwise.
 * Safe to call in contexts where Redis is optional.
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = buildClient(process.env.REDIS_URL);
    client.on('error', (e) => console.warn('[Redis] Connection error:', e.message));
    client.on('ready', ()  => console.info('[Redis] Connected'));
  }
  return client;
}

/**
 * Returns a Redis client, throwing a descriptive error if REDIS_URL is missing.
 * Use this in all paths that require Redis.
 */
export function getRedisOrThrow(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error(
      '[Redis] REDIS_URL environment variable is not set. ' +
      'Set it to your Upstash Redis connection string.'
    );
  }
  return getRedis()!;
}

export default getRedis;
