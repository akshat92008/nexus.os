import { Job } from 'bullmq';

/**
 * Periodically extends the lock on a BullMQ job to prevent it from being 
 * picked up by another worker during long-running agent tasks.
 */
export function startLockExtension(job: Job, taskId: string, intervalMs = 15000, extensionMs = 30000) {
  const interval = setInterval(async () => {
    try {
      await job.extendLock(extensionMs);
      console.log(`[WorkerUtils] 🔒 Extended lock for task ${taskId}`);
    } catch (err) {
      console.warn(`[WorkerUtils] ⚠️ Failed to extend lock for task ${taskId}:`, err);
    }
  }, intervalMs);

  return () => {
    clearInterval(interval);
    console.log(`[WorkerUtils] 🔓 Released lock for task ${taskId}`);
  };
}
