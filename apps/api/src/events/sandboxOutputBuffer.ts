/**
 * Nexus OS — Sandbox Output Buffer (Flood Control)
 * 
 * Batches stdout/stderr from sandboxes before emitting to event bus.
 */

import { eventBuffer } from './eventBuffer.js';

class SandboxOutputBuffer {
  private buffers: Map<string, string[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly FLUSH_INTERVAL_MS = 250;
  private readonly SIZE_THRESHOLD = 50; // Flush if we get more than 50 lines at once

  async append(missionId: string, taskId: string, type: 'stdout' | 'stderr', data: string) {
    const key = `${missionId}:${taskId}:${type}`;
    
    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    
    const buffer = this.buffers.get(key)!;
    buffer.push(data);

    if (buffer.length >= this.SIZE_THRESHOLD) {
      await this.flush(missionId, taskId, type);
    } else if (!this.timers.has(key)) {
      const timer = setTimeout(() => this.flush(missionId, taskId, type), this.FLUSH_INTERVAL_MS);
      this.timers.set(key, timer);
    }
  }

  private async flush(missionId: string, taskId: string, type: 'stdout' | 'stderr') {
    const key = `${missionId}:${taskId}:${type}`;
    const data = this.buffers.get(key) || [];
    
    this.buffers.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }

    if (data.length === 0) return;

    // Emit as a single batched log
    await eventBuffer.publish(missionId, {
      type: type === 'stdout' ? 'sandbox_stdout' : 'sandbox_stderr',
      taskId,
      data: data.join('\n'),
      isBatched: true
    } as any);
  }
}

export const sandboxOutputBuffer = new SandboxOutputBuffer();
