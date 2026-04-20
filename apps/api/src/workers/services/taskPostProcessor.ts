import { Job } from 'bullmq';
import { nexusStateStore } from '../../storage/nexusStateStore.js';
import { sandboxManager } from '../../sandbox/sandboxManager.js';
import { vectorStore } from '../../storage/vectorStore.js';
import { eventBuffer } from '../../events/eventBuffer.js';
import { sandboxOutputBuffer } from '../../events/sandboxOutputBuffer.js';
import type { TypedArtifact, CodeArtifact } from '@nexus-os/types';
import type { TaskJobData } from '../../queue/queue.js';

/**
 * Service for post-processing agent results.
 * Handles sandboxed execution, vector indexing, and atomic task completion.
 */
export async function handlePostProcessing(
  job: Job<TaskJobData>, 
  result: { artifact: any; tokensUsed: number },
  taskLabel: string
) {
  const { taskId, missionId, agentType } = job.data;
  let finalArtifact = result.artifact as TypedArtifact;

  // 1. Sandboxed Code Execution
  if (finalArtifact.format === 'code') {
    const codeArt = finalArtifact as CodeArtifact;
    console.log(`[PostProcessor] 💻 Code detected in task ${taskId}. Sending to sandbox...`);

    await eventBuffer.publish(missionId, {
      type: 'sandbox_started',
      taskId,
      command: codeArt.language === 'python' ? 'python3 execution' : `${codeArt.language} execution`,
    } as any);

    const sandboxResult = await sandboxManager.runCode(
      codeArt.language as any,
      codeArt.code,
      async (type, data) => {
        await sandboxOutputBuffer.append(missionId, taskId, type, data);
      }
    );

    await eventBuffer.publish(missionId, {
      type: 'sandbox_finished',
      taskId,
      exitCode: sandboxResult.exitCode,
    } as any);

    finalArtifact = {
      ...codeArt,
      executionResult: sandboxResult,
      rawContent: `${codeArt.rawContent || ''}\n\n--- Execution Result ---\n${JSON.stringify(sandboxResult, null, 2)}`
    } as any;

    await eventBuffer.publish(missionId, {
      type: 'agent_working',
      taskId,
      taskLabel,
      message: sandboxResult.error ? `Code Execution Failed: ${sandboxResult.error}` : 'Code Execution Succeeded.',
    } as any);
  }

  // 2. Store Artifact in DB
  const artifactRecord = await nexusStateStore.storeArtifact({
    missionId,
    taskId,
    type: agentType,
    content: finalArtifact,
  });

  // 3. Vector Indexing
  try {
    const indexText = finalArtifact.rawContent || JSON.stringify(finalArtifact);
    await vectorStore.indexArtifact(artifactRecord.id, indexText);
  } catch (vecErr) {
    console.warn(`[PostProcessor] 🧠 Vector indexing failed for artifact ${artifactRecord.id}:`, vecErr);
  }

  // 4. Atomic Task Completion
  await nexusStateStore.completeTaskAtomics({
    missionId,
    taskId,
    type: agentType,
    content: finalArtifact,
    tokensUsed: result.tokensUsed
  });

  // 5. Emit Events
  await eventBuffer.publish(missionId, {
    type: 'artifact_created',
    taskId,
    missionId,
    artifact: finalArtifact
  });

  await eventBuffer.publish(missionId, {
    type: 'task_completed',
    taskId,
    missionId,
    artifact: finalArtifact
  });
}
