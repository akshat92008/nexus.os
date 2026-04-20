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
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

const REDIS_URL = process.env.REDIS_URL;

const SSE_HEARTBEAT_INTERVAL_MS = 10_000;
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
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private localEmitter: EventEmitter = new EventEmitter();
  private listeners: Map<string, Set<(event: NexusEvent) => void>> = new Map();
  private isLocalMode: boolean = false;

  constructor() {
    if (!REDIS_URL) {
      logger.warn('[EventBus] REDIS_URL missing. Running in Local Mode (In-Memory).');
      this.isLocalMode = true;
      return;
    }

    try {
      this.publisher  = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
      this.subscriber = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

      this.subscriber.on('message', (channel: string, message: string) => {
        let event: NexusEvent;
        try {
          event = JSON.parse(message) as NexusEvent;
        } catch {
          logger.warn(`[EventBus] Malformed message on "${channel}" — skipping`);
          return;
        }
        this.emitToLocalListeners(channel, event);
      });

      this.publisher.on('error', (e) => logger.warn({ err: e.message }, '[EventBus] Publisher error'));
      this.subscriber.on('error', (e) => logger.warn({ err: e.message }, '[EventBus] Subscriber error'));
    } catch (err: any) {
      logger.error({ err: err.message }, '[EventBus] Failed to connect to Redis. Falling back to Local Mode.');
      this.isLocalMode = true;
    }
  }

  private emitToLocalListeners(channel: string, event: NexusEvent) {
    const handlers = this.listeners.get(channel);
    if (handlers) {
      handlers.forEach((handler) => {
        try { handler(event); }
        catch (err) { logger.error({ err }, `[EventBus] Handler threw on "${channel}"`); }
      });
    }
    // Also emit to the internal event emitter for local-only events
    this.localEmitter.emit(channel, event);
  }

  async publish(missionId: string, event: NexusEvent): Promise<void> {
    const message = JSON.stringify(event);
    const channel = `mission:${missionId}`;

    if (!this.isLocalMode && this.publisher) {
      try {
        const historyKey = `mission:history:${missionId}`;
        await this.publisher.lpush(historyKey, message);
        await this.publisher.ltrim(historyKey, 0, 99);
        await this.publisher.expire(historyKey, 300);
        await this.publisher.publish(channel, message);
        await this.publisher.publish('nexus_global_events', message);
      } catch (err: any) {
        logger.warn({ err: err.message }, '[EventBus] Redis publish failed, using local only');
      }
    }

    // Always emit locally for immediate feedback and as fallback
    this.emitToLocalListeners(channel, event);
    this.emitToLocalListeners('nexus_global_events', event);
  }

  async subscribe(missionId: string, handler: (event: NexusEvent) => void, lastEventId?: string): Promise<void> {
    const channel = `mission:${missionId}`;
    
    if (!this.isLocalMode && this.publisher && lastEventId) {
      try {
        const historyKey = `mission:history:${missionId}`;
        const history = await this.publisher.lrange(historyKey, 0, -1);
        for (const msg of history.reverse()) {
          try { handler(JSON.parse(msg)); } catch {}
        }
      } catch (err) {
        logger.warn('[EventBus] Redis history replay failed');
      }
    }

    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      if (!this.isLocalMode && this.subscriber) {
        this.subscriber.subscribe(channel).catch(e => logger.warn(`[EventBus] Redis sub failed: ${e.message}`));
      }
    }
    this.listeners.get(channel)!.add(handler);
  }

  async subscribeGlobal(handler: (event: NexusEvent) => void): Promise<void> {
    const channel = 'nexus_global_events';
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      if (!this.isLocalMode && this.subscriber) {
        this.subscriber.subscribe(channel).catch(e => logger.warn(`[EventBus] Redis sub global failed: ${e.message}`));
      }
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
        if (!this.isLocalMode && this.subscriber) {
          this.subscriber.unsubscribe(channel).catch(() => {});
        }
      }
    }
  }
}

export const eventBus = new EventBus();
