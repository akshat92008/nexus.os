/**
 * Nexus OS — Task Registry
 *
 * An atomic state machine for every task in a mission.
 * The tryLock() method is the idempotency gate: it prevents duplicate
 * execution on retries, rate-limit restarts, and concurrent calls.
 *
 * Transitions:
 *   pending → locked → running → completed
 *                              → failed → pending (on resetForRetry)
 *   any → skipped (when a critical dependency fails)
 *
 * In production, each status transition should also upsert to Supabase
 * for persistence across server restarts. The async flush is fire-and-forget.
 */

import type { TaskStatus, TaskRecord } from '../../../packages/types/index.js';

const LOCK_TIMEOUT_MS = 90_000; // Zombie lock threshold: 90s

export class TaskRegistry {
  private store = new Map<string, TaskRecord>();
  private missionId: string;

  constructor(missionId: string) {
    this.missionId = missionId;
  }

  /** Idempotent init — safe to call multiple times for the same taskId */
  initTask(taskId: string): void {
    if (!this.store.has(taskId)) {
      this.store.set(taskId, {
        taskId,
        missionId: this.missionId,
        status: 'pending',
        attemptCount: 0,
      });
    }
  }

  /**
   * ATOMIC LOCK — the idempotency gate.
   *
   * Returns true only if this caller successfully claims the task.
   * Returns false if the task is already locked / running / completed.
   *
   * Also detects and breaks zombie locks (task locked >90s with no transition).
   */
  tryLock(taskId: string): boolean {
    const record = this.store.get(taskId);
    if (!record) throw new Error(`[TaskRegistry] Unknown task: ${taskId}`);

    // Break zombie lock: task was locked but the process died before transitioning
    if (record.status === 'locked' && record.lockedAt !== undefined) {
      const age = Date.now() - record.lockedAt;
      if (age > LOCK_TIMEOUT_MS) {
        console.warn(
          `[TaskRegistry] 🧟 Breaking zombie lock on "${taskId}" (locked ${Math.round(age / 1000)}s ago)`
        );
        record.status = 'pending';
        record.lockedAt = undefined;
      }
    }

    if (['locked', 'running', 'completed', 'skipped'].includes(record.status)) {
      return false; // already claimed
    }

    record.status = 'locked';
    record.lockedAt = Date.now();
    record.attemptCount++;
    return true;
  }

  markRunning(taskId: string): void {
    const r = this.getOrThrow(taskId);
    if (r.status !== 'locked') {
      throw new Error(`[TaskRegistry] markRunning: "${taskId}" expected locked, got ${r.status}`);
    }
    r.status = 'running';
  }

  markCompleted(taskId: string, outputKey: string): void {
    const r = this.getOrThrow(taskId);
    r.status = 'completed';
    r.completedAt = Date.now();
    r.outputKey = outputKey;
  }

  markFailed(taskId: string, error: string): void {
    const r = this.getOrThrow(taskId);
    // Allow failing from locked/running states
    r.status = 'failed';
    r.errorMessage = error.slice(0, 500);
  }

  markSkipped(taskId: string): void {
    const r = this.getOrThrow(taskId);
    r.status = 'skipped';
  }

  isCompleted(taskId: string): boolean {
    return this.store.get(taskId)?.status === 'completed';
  }

  isFailed(taskId: string): boolean {
    return this.store.get(taskId)?.status === 'failed';
  }

  getStatus(taskId: string): TaskStatus | undefined {
    return this.store.get(taskId)?.status;
  }

  getAttemptCount(taskId: string): number {
    return this.store.get(taskId)?.attemptCount ?? 0;
  }

  canRetry(taskId: string, maxRetries: number): boolean {
    const r = this.store.get(taskId);
    return r?.status === 'failed' && (r.attemptCount ?? 0) <= maxRetries;
  }

  resetForRetry(taskId: string): void {
    const r = this.getOrThrow(taskId);
    if (r.status !== 'failed') {
      throw new Error(`[TaskRegistry] resetForRetry: "${taskId}" is not failed (status: ${r.status})`);
    }
    r.status = 'pending';
    r.errorMessage = undefined;
    r.lockedAt = undefined;
  }

  getFailedTasks(): TaskRecord[] {
    return [...this.store.values()].filter((r) => r.status === 'failed');
  }

  getCompletedTasks(): TaskRecord[] {
    return [...this.store.values()].filter((r) => r.status === 'completed');
  }

  getSummary(): Record<TaskStatus, number> {
    const counts: Record<TaskStatus, number> = {
      pending: 0, locked: 0, running: 0, completed: 0, failed: 0, skipped: 0,
    };
    for (const r of this.store.values()) {
      counts[r.status]++;
    }
    return counts;
  }

  private getOrThrow(taskId: string): TaskRecord {
    const r = this.store.get(taskId);
    if (!r) throw new Error(`[TaskRegistry] Unknown task: "${taskId}"`);
    return r;
  }
}
