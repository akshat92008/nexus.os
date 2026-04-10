import { Job } from 'bullmq';

/**
 * Periodically extends the lock on a BullMQ job to prevent it from being 
 * picked up by another worker during long-running agent tasks.
 */
export function startLockExtension(job: Job, taskId: string, intervalMs = 15000, extensionMs = 30000) {
  const interval = setInterval(async () => {
    try {
      const active = await job.isActive();
      if (active) {
        await job.extendLock(job.token ?? '', extensionMs);
        console.log(`[WorkerUtils] 🔒 Extended lock for task ${taskId}`);
      } else {
        clearInterval(interval);
      }
    } catch (err) {
      console.warn(`[WorkerUtils] ⚠️ Failed to extend lock for task ${taskId}:`, err);
      clearInterval(interval);
    }
  }, intervalMs);

  return () => {
    clearInterval(interval);
    console.log(`[WorkerUtils] 🔓 Released lock for task ${taskId}`);
  };
}
