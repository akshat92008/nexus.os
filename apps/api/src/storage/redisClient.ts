/**
 * Nexus OS — Redis Client (with Resilient Fallback)
 *
 * Implements a Graceful Degradation pattern (Ticket 4).
 * If Redis is unavailable or fails during a call, it transparently 
 * falls back to a local in-memory Map.
 */

import { Redis } from 'ioredis';
import { logger } from '../logger.js';

const localCache = new Map<string, string>();

/**
 * Resilient wrapper for Redis operations.
 * Transparently falls back to in-memory Map on connection errors.
 */
class ResilientRedis {
  constructor(private client: Redis | null) {}

  async get(key: string): Promise<string | null> {
    if (!this.client) return localCache.get(key) ?? null;
    try {
      return await this.client.get(key);
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[Redis] Get failed, falling back to local memory');
      return localCache.get(key) ?? null;
    }
  }

  async set(key: string, value: string, mode?: 'EX', duration?: number): Promise<'OK' | null> {
    // Basic Map implementation ignores TTL for fallback
    localCache.set(key, value);
    
    if (!this.client) return 'OK';
    try {
      if (mode === 'EX' && duration) {
        return await this.client.set(key, value, mode, duration);
      }
      return await this.client.set(key, value);
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[Redis] Set failed, stored in local memory only');
      return 'OK';
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) {
      const val = parseInt(localCache.get(key) || '0', 10) + 1;
      localCache.set(key, val.toString());
      return val;
    }
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[Redis] Incr failed, using local memory');
      const val = parseInt(localCache.get(key) || '0', 10) + 1;
      localCache.set(key, val.toString());
      return val;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.client) return 1;
    try {
      return await this.client.expire(key, seconds);
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[Redis] Expire failed');
      return 1;
    }
  }

  async ping(): Promise<string> {
    if (!this.client) return 'PONG (Local Fallback)';
    try {
      return await this.client.ping();
    } catch (err: any) {
      logger.warn({ err: err.message }, '[Redis] Ping failed');
      return 'PONG (Degraded)';
    }
  }

  // Pass-through for other essential methods if needed
  on(event: string, handler: (...args: any[]) => void) {
    this.client?.on(event, handler);
  }
}

let clientInstance: Redis | null = null;
let safeClient: ResilientRedis | null = null;

function buildClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 100, 30000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

/**
 * Returns a ResilientRedis wrapper.
 */
export function getRedis(): ResilientRedis {
  if (!safeClient) {
    const url = process.env.REDIS_URL;
    if (url) {
      clientInstance = buildClient(url);
      clientInstance.on('error', (e) => logger.warn({ err: e.message }, '[Redis] Connection error'));
      clientInstance.on('ready', () => logger.info('[Redis] Connected'));
    }
    safeClient = new ResilientRedis(clientInstance);
  }
  return safeClient;
}

/**
 * Kept for backward compatibility, now behaves like getRedis.
 */
export function getRedisOrThrow(): ResilientRedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.error('[Redis] REDIS_URL not set, strictly using in-memory fallback');
  }
  return getRedis();
}

export default getRedis;
