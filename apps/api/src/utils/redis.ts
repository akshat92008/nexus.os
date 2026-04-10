/**
 * Nexus OS — Redis Fallback Utility (Ticket 4)
 *
 * Implements graceful degradation via a simple in-memory local Map.
 * This ensures the application does not crash if Redis/Upstash is unavailable.
 */

import Redis from 'ioredis';
import { logger } from '../logger.js';

const localCache = new Map<string, any>();

class RedisUtility {
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      try {
        this.client = new Redis(url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 30000),
        });

        this.client.on('error', (err) => {
          logger.warn({ err: err.message }, '[RedisUtility] Connection error — using local fallback');
        });
      } catch (err) {
        logger.warn('[RedisUtility] Failed to initialize Redis client — using local fallback');
      }
    } else {
      logger.info('[RedisUtility] REDIS_URL not set — using local in-memory cache');
    }
  }

  async get(key: string): Promise<any> {
    try {
      if (this.client) {
        return await this.client.get(key);
      }
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[RedisUtility] get failed — falling back to local memory');
    }
    return localCache.get(key) ?? null;
  }

  async set(key: string, value: any, mode?: 'EX', duration?: number): Promise<'OK' | null> {
    // Basic local cache persistence (ignore TTL for simplicity in fallback)
    localCache.set(key, value);

    try {
      if (this.client) {
        if (mode === 'EX' && duration) {
          return await this.client.set(key, value, mode, duration);
        }
        return await this.client.set(key, value);
      }
    } catch (err: any) {
      logger.warn({ key, err: err.message }, '[RedisUtility] set failed — stored in local memory only');
    }
    return 'OK';
  }
}

export const redisUtils = new RedisUtility();
export default redisUtils;
