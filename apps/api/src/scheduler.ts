/**
 * Agentic OS — Scheduler Engine (BullMQ-Backed)
 *
 * Converts the one-shot DAG into a Living Execution Graph.
 * Replaces the old setInterval tick with durable BullMQ repeatable jobs.
 */

import { systemQueue } from './queue/queue.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
import type { FrequencyType, ScheduleSnapshot } from '@nexus-os/types';

// ── Frequency to Cron Map ──────────────────────────────────────────────────

const FREQUENCY_TO_CRON: Record<FrequencyType, string> = {
  hourly:  '0 * * * *',
  daily:   '0 0 * * *',
  weekly:  '0 0 * * 0',
  monthly: '0 0 1 * *',
  research: '0 */6 * * *', // Custom frequency for research
};

class SchedulerEngine {
  /**
   * Register a recurring execution on a workspace.
   * Now uses BullMQ repeatable jobs for cloud-safe scheduling.
   */
  async scheduleWorkspace(params: {
    workspaceId: string;
    goal:        string;
    userId:      string;
    frequency:   FrequencyType;
  }): Promise<void> {
    const scheduleId = `sched_${crypto.randomUUID().slice(0, 10)}`;
    const cron = FREQUENCY_TO_CRON[params.frequency] || '0 0 * * *';

    // 1. Persist to DB
    await nexusStateStore.upsertSchedule(params.userId, {
      scheduleId,
      workspaceId: params.workspaceId,
      goal: params.goal,
      cron,
      enabled: true,
      lastRun: null,
      nextRun: 0, // Will be calculated by BullMQ
    } as ScheduleSnapshot);

    // 2. Add to BullMQ as a repeatable job
    await systemQueue.add(
      `scheduled_mission_${scheduleId}`,
      {
        type: 'scheduled_mission',
        userId: params.userId,
        workspaceId: params.workspaceId,
        goal: params.goal,
      },
      {
        repeat: { pattern: cron },
        jobId: scheduleId, // Use fixed ID to allow cancellation
      }
    );

    console.log(`[Scheduler] ⏰ Cloud-safe schedule registered: ${scheduleId} (${params.frequency})`);
  }

  /**
   * Cancel a schedule.
   */
  async cancelSchedule(scheduleId: string): Promise<void> {
    // 1. Remove from BullMQ
    // BullMQ requires the same repeat options to remove a repeatable job
    // This is a bit tricky, usually we'd fetch the job first.
    const repeatableJobs = await systemQueue.getRepeatableJobs();
    const job = repeatableJobs.find(j => j.id === scheduleId);
    
    if (job) {
      await systemQueue.removeRepeatableByKey(job.key);
    }

    // 2. Update DB (could also just delete)
    // await nexusStateStore.removeSchedule(userId, scheduleId);
    
    console.log(`[Scheduler] ❌ Cancelled: ${scheduleId}`);
  }
}

export const schedulerEngine = new SchedulerEngine();
