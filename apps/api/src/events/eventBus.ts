/**
 * Nexus OS — Event Bus
 *
 * Fixes applied:
 *  - JSON.parse wrapped in try/catch — malformed messages are logged and skipped
 *  - attachSSEHeartbeat(): sends ": ping" every 25s to prevent proxy timeouts
 *  - attachSSETimeout(): auto-closes stale SSE connections after 10 minutes
 */

import { Redis } from 'ioredis';
import type { Response } from 'express';
import type { NexusEvent } from '../db/models.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error('[EventBus] REDIS_URL environment variable is required');
}

const SSE_HEARTBEAT_INTERVAL_MS = 25_000;
const SSE_MAX_LIFETIME_MS       = 10 * 60 * 1000;

export function attachSSEHeartbeat(res: Response): () => void {
  const interval = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, SSE_HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(interval);
}

export function attachSSETimeout(res: Response, onTimeout?: () => void): () => void {
  const timer = setTimeout(() => {
    if (!res.writableEnded) {
      res.write('data: {"type":"timeout","message":"Stream closed after 10 minutes"}\n\n');
      res.end();
    }
    onTimeout?.();
  }, SSE_MAX_LIFETIME_MS);
  return () => clearTimeout(timer);
}

class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private listeners: Map<string, Set<(event: NexusEvent) => void>> = new Map();

  constructor() {
    this.publisher  = new Redis(REDIS_URL!);
    this.subscriber = new Redis(REDIS_URL!);

    this.subscriber.on('message', (channel: string, message: string) => {
      let event: NexusEvent;
      try {
        event = JSON.parse(message) as NexusEvent;
      } catch {
        console.warn(`[EventBus] Malformed message on "${channel}" — skipping:`, message.slice(0, 200));
        return;
      }
      const handlers = this.listeners.get(channel);
      if (handlers) {
        handlers.forEach((handler) => {
          try { handler(event); }
          catch (err) { console.error(`[EventBus] Handler threw on "${channel}":`, err); }
        });
      }
    });

    this.publisher.on('error',  (e) => console.warn('[EventBus] Publisher error:', e.message));
    this.subscriber.on('error', (e) => console.warn('[EventBus] Subscriber error:', e.message));
  }

  async publish(missionId: string, event: NexusEvent): Promise<void> {
    const message = JSON.stringify(event);
    
    // ── SSE Buffering (Ticket 2) ───────────────────────────────────────────
    // Store in a Redis list with 5-minute TTL to allow reconnection catch-up
    const historyKey = `mission:history:${missionId}`;
    await this.publisher.lpush(historyKey, message);
    await this.publisher.ltrim(historyKey, 0, 99); // Keep last 100 events
    await this.publisher.expire(historyKey, 300);   // 5 minute TTL
    
    await this.publisher.publish(`mission:${missionId}`, message);
    await this.publisher.publish('nexus_global_events', message);
  }

  /**
   * Subscribes to mission events. 
   * (Ticket 2) Optionally replays history from Redis if lastEventId is provided.
   */
  async subscribe(missionId: string, handler: (event: NexusEvent) => void, lastEventId?: string): Promise<void> {
    const channel = `mission:${missionId}`;
    
    // Catch-up logic for Ticket 2
    if (lastEventId) {
      const historyKey = `mission:history:${missionId}`;
      const history = await this.publisher.lrange(historyKey, 0, -1);
      // Redis LPUSH keeps newest first, so we reverse to play in chronological order
      // Note: This simple implementation just replays ALL buffered events for safety
      // as NexusEvent doesn't have unique sequential IDs yet.
      for (const msg of history.reverse()) {
        try { handler(JSON.parse(msg)); } catch {}
      }
    }

    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.listeners.get(channel)!.add(handler);
  }

  async subscribeGlobal(handler: (event: NexusEvent) => void): Promise<void> {
    const channel = 'nexus_global_events';
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.listeners.get(channel)!.add(handler);
  }

  async unsubscribe(missionId: string, handler: (event: NexusEvent) => void): Promise<void> {
    const channel = `mission:${missionId}`;
    const handlers = this.listeners.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    }
  }
}

export const eventBus = new EventBus();
