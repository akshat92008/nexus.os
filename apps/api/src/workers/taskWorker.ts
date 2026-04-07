/**
 * Nexus OS — Task Worker (Durable Execution)
 * 
 * Separate process that executes individual agent tasks.
 * Upgraded to handle:
 * 1. Sandboxed Code Execution
 * 2. Dynamic Tool Calling
 * 3. Vector Memory Indexing
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { runAgent } from '../agentRunner.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { tasksQueue, TaskJobData } from '../queue/queue.js';
import { sandboxManager } from '../sandbox/sandboxManager.js';
import { toolExecutor } from '../tools/toolExecutor.js';
import { vectorStore } from '../storage/vectorStore.js';
import type { TypedArtifact, CodeArtifact, AgentContext, MemoryEntry } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const taskWorker = new Worker<TaskJobData>(
  'tasks',
  async (job: Job<TaskJobData>) => {
    const { taskId, missionId, workspaceId, agentType, input, contextFields } = job.data;

    console.log(`[Worker] 🛠️  Executing task: ${taskId} (${agentType}) — Mission: ${missionId}`);

    try {
      // 1. Update Task status to 'running'
      await nexusStateStore.updateTaskStatus(taskId, 'running');

      // 2. Publish start event
      await eventBus.publish(missionId, {
        type: 'task_started',
        taskId,
        missionId,
        label: input.label,
        agentType
      });

      // 3. Build AgentContext from DB
      const context: AgentContext = {
        entries: [],
        promptBlock: ''
      };

      if (contextFields && contextFields.length > 0) {
        const artifacts = await nexusStateStore.fetchArtifactsByContext(missionId, contextFields);
        context.entries = artifacts.map((a: any) => ({
          key: `artifact:${a.task_id}`,
          taskId: a.task_id,
          agentType: a.type,
          data: a.content,
          writtenAt: new Date(a.created_at).getTime(),
          tokensUsed: 0
        } as MemoryEntry));

        context.promptBlock = artifacts.map((a: any) => 
          `--- Context from Task: ${a.task_id} ---\n${JSON.stringify(a.content, null, 2)}`
        ).join('\n\n');
      }

      // 4. Run the Agent
      const result = await runAgent({
        task: input,
        goal: input.label,
        goalType: 'general',
        context,
        isAborted: () => false
      });

      let finalArtifact = result.artifact as TypedArtifact;

      // ── PHASE 1: Sandboxed Code Execution ─────────────────────────────────
      
      if (finalArtifact.format === 'code') {
        const codeArt = finalArtifact as CodeArtifact;
        console.log(`[Worker] 💻 Code detected in task ${taskId}. Sending to sandbox...`);

        const sandboxResult = await sandboxManager.runCode(
          codeArt.language as any,
          codeArt.code
        );

        // Append execution results to the artifact
        finalArtifact = {
          ...codeArt,
          executionResult: sandboxResult,
          rawContent: `${codeArt.rawContent || ''}\n\n--- Execution Result ---\n${JSON.stringify(sandboxResult, null, 2)}`
        } as any;

        // Emit execution event
        await eventBus.publish(missionId, {
          type: 'agent_working',
          taskId,
          taskLabel: input.label,
          message: sandboxResult.error ? `Code Execution Failed: ${sandboxResult.error}` : 'Code Execution Succeeded.',
        } as any);
      }

      // 5. Store Final Artifact in DB
      const artifactRecord = await nexusStateStore.storeArtifact({
        missionId,
        taskId,
        type: agentType,
        content: finalArtifact,
      });

      // ── PHASE 3: Vector Memory Indexing ──────────────────────────────────
      try {
        const indexText = finalArtifact.rawContent || JSON.stringify(finalArtifact);
        await vectorStore.indexArtifact(artifactRecord.id, indexText);
      } catch (vecErr) {
        console.warn(`[Worker] 🧠 Vector indexing failed for artifact ${artifactRecord.id}:`, vecErr);
        // Don't fail the task if indexing fails
      }

      // 6. Update Task status to 'completed'
      await nexusStateStore.updateTaskStatus(taskId, 'completed', {
        artifactId: artifactRecord.id,
        tokensUsed: result.tokensUsed,
      });

      // 7. Publish completion events
      await eventBus.publish(missionId, {
        type: 'artifact_created',
        taskId,
        missionId,
        artifact: finalArtifact
      });

      await eventBus.publish(missionId, {
        type: 'task_completed',
        taskId,
        missionId,
        artifact: finalArtifact
      });

    } catch (err: any) {
      console.error(`[Worker] ❌ Task failed: ${taskId}`, err);
      
      await nexusStateStore.updateTaskStatus(taskId, 'failed', { error: err.message });

      await eventBus.publish(missionId, {
        type: 'task_failed',
        taskId,
        missionId,
        error: err.message
      });
      throw err;
    }
  },
  { connection, concurrency: 5 }
);

taskWorker.on('failed', (job, err) => {
  console.error(`[Worker] 🚨 Job ${job?.id} failed persistently:`, err);
});
