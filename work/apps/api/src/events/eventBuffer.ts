/**
 * Nexus OS — Event Buffer (Flood Control)
 * 
 * Batches events for a short duration (100-300ms) before publishing.
 * This prevents the frontend from freezing during high-velocity updates.
 */

import { eventBus } from './eventBus.js';

class EventBuffer {
  private buffers: Map<string, any[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_WINDOW_MS = 200;

  /**
   * Queue an event for buffered publication.
   */
  async publish(missionId: string, event: any): Promise<void> {
    const channel = `mission:${missionId}`;
    
    // 1. Add to buffer
    if (!this.buffers.has(channel)) {
      this.buffers.set(channel, []);
    }
    this.buffers.get(channel)!.push(event);

    // 2. Schedule flush if not already scheduled
    if (!this.timers.has(channel)) {
      const timer = setTimeout(() => this.flush(missionId), this.BATCH_WINDOW_MS);
      this.timers.set(channel, timer);
    }
  }

  /**
   * Immediately publish all events in the buffer.
   */
  private async flush(missionId: string) {
    const channel = `mission:${missionId}`;
    const events = this.buffers.get(channel) || [];
    
    // Clear buffer and timer
    this.buffers.delete(channel);
    this.timers.delete(channel);

    if (events.length === 0) return;

    if (events.length === 1) {
      // Single event: publish as is
      await eventBus.publish(missionId, events[0]);
    } else {
      // Multiple events: batch into a single payload
      await eventBus.publish(missionId, {
        type: 'event_batch',
        missionId,
        events,
        count: events.length,
        timestamp: Date.now()
      } as any);
    }
  }
}

export const eventBuffer = new EventBuffer();
