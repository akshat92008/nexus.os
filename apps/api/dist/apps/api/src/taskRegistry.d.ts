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
export declare class TaskRegistry {
    private store;
    private missionId;
    constructor(missionId: string);
    /** Idempotent init — safe to call multiple times for the same taskId */
    initTask(taskId: string): void;
    /**
     * ATOMIC LOCK — the idempotency gate.
     *
     * Returns true only if this caller successfully claims the task.
     * Returns false if the task is already locked / running / completed.
     *
     * Also detects and breaks zombie locks (task locked >90s with no transition).
     */
    tryLock(taskId: string): boolean;
    markRunning(taskId: string): void;
    markCompleted(taskId: string, outputKey: string): void;
    markFailed(taskId: string, error: string): void;
    markSkipped(taskId: string): void;
    isCompleted(taskId: string): boolean;
    isFailed(taskId: string): boolean;
    getStatus(taskId: string): TaskStatus | undefined;
    getAttemptCount(taskId: string): number;
    canRetry(taskId: string, maxRetries: number): boolean;
    resetForRetry(taskId: string): void;
    getFailedTasks(): TaskRecord[];
    getCompletedTasks(): TaskRecord[];
    getSummary(): Record<TaskStatus, number>;
    private getOrThrow;
}
//# sourceMappingURL=taskRegistry.d.ts.map