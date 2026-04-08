/**
 * Nexus OS — Event Bus
 * 
 * Decentralized event system using Redis Pub/Sub.
 * Decouples core logic from Express 'res' objects.
 */

import { Redis } from 'ioredis';
import type { NexusEvent } from '../db/models.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private listeners: Map<string, Set<(event: NexusEvent) => void>> = new Map();

  constructor() {
    this.publisher = new Redis(REDIS_URL);
    this.subscriber = new Redis(REDIS_URL);

    this.subscriber.on('message', (channel: string, message: string) => {
      const event = JSON.parse(message) as NexusEvent;
      const handlers = this.listeners.get(channel);
      if (handlers) {
        handlers.forEach(handler => handler(event));
      }
    });
  }

  /**
   * Publish an event to a mission-specific channel
   */
  async publish(missionId: string, event: NexusEvent): Promise<void> {
    await this.publisher.publish(`mission:${missionId}`, JSON.stringify(event));
    // Also publish to a global channel for system-wide monitoring
    await this.publisher.publish('nexus_global_events', JSON.stringify(event));
  }

  /**
   * Subscribe to events for a specific mission
   */
  async subscribe(missionId: string, handler: (event: NexusEvent) => void): Promise<void> {
    const channel = `mission:${missionId}`;
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.listeners.get(channel)!.add(handler);
  }

  /**
   * Global listener for internal OS orchestration (event-driven)
   */
  async subscribeGlobal(handler: (event: NexusEvent) => void): Promise<void> {
    const channel = 'nexus_global_events';
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.listeners.get(channel)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
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
