import { Job } from 'bullmq';
import { runAgent } from '../../agents/agentRunner.js';
import { nexusStateStore } from '../../storage/nexusStateStore.js';
import { eventBuffer } from '../../events/eventBuffer.js';
import { buildTaskContext } from '../services/taskContextService.js';
import { handlePostProcessing } from '../services/taskPostProcessor.js';
import { startLockExtension } from '../utils/workerUtils.js';
import type { TaskJobData } from '../../queue/queue.js';

/**
 * The core execution handler for individual agent tasks.
 * Orchestrates the full lifecycle of a task job.
 */
export async function handleTaskJob(job: Job<TaskJobData>) {
  const { taskId, missionId, agentType, input, contextFields } = job.data;

  console.log(`[TaskHandler] 🛠️ Executing task: ${taskId} (${agentType}) — Mission: ${missionId}`);

  // 1. Check for Idempotency
  const task = await nexusStateStore.getTask(taskId);
  if (task.status === 'completed') {
    console.log(`[TaskHandler] ✅ Task ${taskId} already completed. Skipping.`);
    return;
  }

  const checkpoint = task.input_payload?._checkpoint;
  let resumeFromStep = checkpoint?.step || 'start';

  if (resumeFromStep === 'agent_finished' && checkpoint) {
    console.log(`[TaskHandler] ⏩ Resuming Task ${taskId} from 'agent_finished' checkpoint.`);
    const result = {
      artifact: checkpoint.data,
      tokensUsed: checkpoint.tokensUsed || 0
    };
    return await handlePostProcessing(job, result, input.label);
  }

  // 2. Start Life-cycle: Running
  await nexusStateStore.updateTaskStatus(taskId, 'running');
  await eventBuffer.publish(missionId, {
    type: 'task_started',
    taskId,
    missionId,
    label: input.label,
    agentType
  });

  // 3. Keep-alive lock extension
  const stopLockExtension = startLockExtension(job, taskId);

  try {
    // 4. Prepare Context
    const context = await buildTaskContext(missionId, contextFields);
    await nexusStateStore.updateTaskCheckpoint(taskId, { step: 'context_ready' });

    // 5. Execute Agent
    const result = await runAgent({
      task: input,
      goal: input.label,
      goalType: 'general',
      context,
      isAborted: () => false
    });

    // 6. Checkpoint: Agent Finished
    await nexusStateStore.updateTaskCheckpoint(taskId, { 
      step: 'agent_finished', 
      data: result.artifact,
      tokensUsed: result.tokensUsed 
    });

    // 7. Post-Processing
    await handlePostProcessing(job, result, input.label);

  } catch (err: any) {
    console.error(`[TaskHandler] ❌ Task failed: ${taskId}`, err);
    await nexusStateStore.updateTaskStatus(taskId, 'failed', { error: err.message });
    await eventBuffer.publish(missionId, {
      type: 'task_failed',
      taskId,
      missionId,
      error: err.message
    });
    throw err; // Let BullMQ handle retries
  } finally {
    stopLockExtension();
  }
}
