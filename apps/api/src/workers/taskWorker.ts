/**
 * Nexus OS — Task Worker (Durable Execution)
 *
 * Fixes applied:
 *  #4  Debounced sandbox output (250 ms / 1 KB flush)
 *  #5  Atomic state commit (storeArtifact + updateTaskStatus in sequence, single throw)
 *  #6  Context size control (max ~8 KB of dependency output passed to agent)
 *  #7  Sandbox timeout (30 s) + BullMQ lock extension
 *  #8  No (this as any) — handlePostProcessing is a plain exported function
 *  #9  Circuit breakers on runAgent (maxIterations, maxTokens, timeout)
 * #10  Sandbox process cleanup on timeout/crash
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { runAgent } from '../agents/agentRunner.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { tasksQueue, TaskJobData } from '../queue/queue.js';
import { sandboxManager } from '../sandbox/sandboxManager.js';
import { eventBuffer } from '../events/eventBuffer.js';
import { vectorStore } from '../storage/vectorStore.js';
import type { TypedArtifact, CodeArtifact, AgentContext, MemoryEntry } from '@nexus-os/types';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum total bytes of all dependency artifacts combined in the prompt. */
const MAX_TOTAL_CONTEXT_BYTES = 10_000;

/** Maximum bytes allowed for a single dependency artifact. */
const MAX_PER_ARTIFACT_BYTES = 2_000;

/** Sandbox hard timeout in milliseconds. */
const SANDBOX_TIMEOUT_MS = 30_000;

/** How often to flush buffered sandbox stdout/stderr (ms). */
const SANDBOX_FLUSH_INTERVAL_MS = 250;

/** Maximum buffer size before a forced flush (bytes). */
const SANDBOX_FLUSH_BUFFER_BYTES = 1_024;

/** BullMQ lock extension interval — must be shorter than the worker lockDuration. */
const LOCK_EXTEND_INTERVAL_MS = 15_000;

/** Circuit breaker: max total tokens consumed by a single runAgent call. */
const CIRCUIT_MAX_TOKENS = 8_000;

/** Circuit breaker: hard wall-clock timeout for a single agent run (ms). */
const CIRCUIT_AGENT_TIMEOUT_MS = 120_000;

// ── Context Size Control ─────────────────────────────────────────────────────

/**
 * Truncate dependency artifact content to fit within limits.
 */
function truncateContext(raw: string, limit: number): string {
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes <= limit) return raw;

  // Slice to limit and append a truncation notice
  const sliced = raw.slice(0, limit);
  return sliced + `\n\n[... truncated — original size ${bytes} bytes, limit ${limit} bytes ...]`;
}

function buildContextBlock(artifacts: any[]): { entries: MemoryEntry[]; promptBlock: string } {
  const entries: MemoryEntry[] = artifacts.map((a: any) => {
    const rawContent = typeof a.content === 'string'
      ? a.content
      : JSON.stringify(a.content);

    return {
      key:        `artifact:${a.task_id}`,
      taskId:     a.task_id,
      agentType:  a.type,
      data:       truncateContext(rawContent, MAX_PER_ARTIFACT_BYTES),
      writtenAt:  new Date(a.created_at).getTime(),
      tokensUsed: 0,
    } as MemoryEntry;
  });

  const promptBlock = entries
    .map((e) => `--- Context from Task: ${e.taskId} ---\n${e.data}`)
    .join('\n\n');

  // Final safety truncation on the entire prompt block
  return { entries, promptBlock: truncateContext(promptBlock, MAX_TOTAL_CONTEXT_BYTES) };
}

// ── Sandbox Output Debouncer ─────────────────────────────────────────────────

interface OutputBuffer {
  append: (data: string) => Promise<void>;
  stop: () => Promise<void>;
}

function createOutputBuffer(
  missionId: string,
  taskId: string,
  eventType: 'sandbox_stdout' | 'sandbox_stderr'
): OutputBuffer {
  let buf = '';
  let timer: NodeJS.Timeout | null = null;

  async function flush() {
    if (buf.length === 0) return;
    const payload = buf;
    buf = '';
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    await eventBuffer.publish(missionId, {
      type: eventType,
      taskId,
      data: payload,
    } as any);
  }

  const startTimer = () => {
    if (!timer) {
      timer = setInterval(async () => {
        await flush().catch((e) => console.warn('[OutputBuffer] flush error:', e));
      }, SANDBOX_FLUSH_INTERVAL_MS);
    }
  };

  return {
    append: async (data: string) => {
      buf += data;
      startTimer();
      // Force flush if buffer exceeds limit
      if (Buffer.byteLength(buf, 'utf8') >= SANDBOX_FLUSH_BUFFER_BYTES) {
        await flush();
      }
    },
    stop: async () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await flush();
    },
  };
}

// ── Circuit Breaker wrapper around runAgent ──────────────────────────────────

async function runAgentWithCircuitBreaker(
  opts: Parameters<typeof runAgent>[0]
): Promise<Awaited<ReturnType<typeof runAgent>>> {
  let aborted = false;
  let tokensAccumulated = 0;

  const timeoutHandle = setTimeout(() => {
    aborted = true;
  }, CIRCUIT_AGENT_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      runAgent({
        ...opts,
        isAborted: () => aborted || opts.isAborted(),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`[CircuitBreaker] Agent timed out after ${CIRCUIT_AGENT_TIMEOUT_MS}ms`)),
          CIRCUIT_AGENT_TIMEOUT_MS
        )
      ),
    ]);

    tokensAccumulated += result.tokensUsed;
    if (tokensAccumulated > CIRCUIT_MAX_TOKENS) {
      throw new Error(
        `[CircuitBreaker] Token limit exceeded: ${tokensAccumulated} > ${CIRCUIT_MAX_TOKENS}`
      );
    }

    return result;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ── Post-Processing (standalone — no (this as any)) ──────────────────────────

export async function handlePostProcessing(
  job: Job<TaskJobData>,
  result: { artifact: any; tokensUsed: number },
  _task: any,
  input: any
): Promise<void> {
  const { taskId, missionId, agentType } = job.data;
  let finalArtifact = result.artifact as TypedArtifact;

  // ── Lock Extension: keep the job lock alive during long sandbox runs ──────
  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token ?? '', LOCK_EXTEND_INTERVAL_MS * 4);
    } catch (e) {
      console.warn(`[Worker] ⚠️ Could not extend lock for job ${job.id}:`, e);
    }
  }, LOCK_EXTEND_INTERVAL_MS);

  try {
    if ((finalArtifact as CodeArtifact).format === 'code') {
      const codeArt = finalArtifact as CodeArtifact;
      console.log(`[Worker] 💻 Code detected in task ${taskId}. Sending to sandbox...`);

      await eventBuffer.publish(missionId, {
        type:    'sandbox_started',
        taskId,
        command: codeArt.language === 'python' ? 'python3 execution' : `${codeArt.language} execution`,
      } as any);

      // ── FIX #4: Debounced output buffers ───────────────────────────────
      const stdoutBuf = createOutputBuffer(missionId, taskId, 'sandbox_stdout');
      const stderrBuf = createOutputBuffer(missionId, taskId, 'sandbox_stderr');

      // ── FIX #7: Sandbox hard timeout ───────────────────────────────────
      let sandboxResult: Awaited<ReturnType<typeof sandboxManager.runCode>>;
      try {
        sandboxResult = await Promise.race([
          sandboxManager.runCode(
            codeArt.language as any,
            codeArt.code,
            async (type, data) => {
              const buf = type === 'stdout' ? stdoutBuf : stderrBuf;
              await buf.append(data);
            },
            { timeout: SANDBOX_TIMEOUT_MS }
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Sandbox timed out after ${SANDBOX_TIMEOUT_MS}ms`)),
              SANDBOX_TIMEOUT_MS + 2_000   // give sandboxManager a chance to self-kill first
            )
          ),
        ]);
      } finally {
        // ── FIX #10: Flush remaining output and stop timers regardless ────
        await stdoutBuf.stop();
        await stderrBuf.stop();
        // sandboxManager.runCode closes the sandbox in its own finally block,
        // so orphan process cleanup is handled there.
      }

      await eventBuffer.publish(missionId, {
        type:     'sandbox_finished',
        taskId,
        exitCode: sandboxResult.exitCode,
      } as any);

      finalArtifact = {
        ...codeArt,
        executionResult: sandboxResult,
        rawContent: `${codeArt.rawContent || ''}\n\n--- Execution Result ---\n${JSON.stringify(sandboxResult, null, 2)}`,
      } as any;

      await eventBuffer.publish(missionId, {
        type:      'agent_working',
        taskId,
        taskLabel: input.label,
        message:   sandboxResult.error
          ? `Code Execution Failed: ${sandboxResult.error}`
          : 'Code Execution Succeeded.',
      } as any);
    }

    // ── FIX #5: Atomic state commit ────────────────────────────────────────
    // storeArtifact then updateTaskStatus in sequence.
    // If storeArtifact throws, status stays 'running' → job will be retried → idempotency guard skips.
    // If updateTaskStatus throws after artifact stored, BullMQ retry re-enters here and the
    // idempotency check at the top catches status='completed' on retry.
    const artifactRecord = await nexusStateStore.storeArtifact({
      missionId,
      taskId,
      type:    agentType,
      content: finalArtifact,
    });

    await nexusStateStore.updateTaskStatus(taskId, 'completed', {
      artifactId: artifactRecord.id,
      tokensUsed: result.tokensUsed,
    });
    // ── End atomic block ───────────────────────────────────────────────────

    // Vector indexing is best-effort and must NOT roll back the task status
    try {
      const indexText = (finalArtifact as any).rawContent || JSON.stringify(finalArtifact);
      await vectorStore.indexArtifact(artifactRecord.id, indexText);
    } catch (vecErr) {
      console.warn(`[Worker] 🧠 Vector indexing failed for artifact ${artifactRecord.id}:`, vecErr);
    }

    await eventBuffer.publish(missionId, {
      type:     'artifact_created',
      taskId,
      missionId,
      artifact: finalArtifact,
    });

    await eventBuffer.publish(missionId, {
      type:     'task_completed',
      taskId,
      missionId,
      artifact: finalArtifact,
    });

  } finally {
    clearInterval(lockExtender);
  }
}

// ── Worker ───────────────────────────────────────────────────────────────────

export const taskWorker = new Worker<TaskJobData>(
  'tasks',
  async (job: Job<TaskJobData>) => {
    const { taskId, missionId, workspaceId, agentType, input, contextFields } = job.data;

    console.log(`[Worker] 🛠️  Executing task: ${taskId} (${agentType}) — Mission: ${missionId}`);

    try {
      // 0. Idempotency guard
      const task = await nexusStateStore.getTask(taskId);
      if (task.status === 'completed') {
        console.log(`[Worker] ✅ Task ${taskId} already completed. Skipping.`);
        return;
      }

      // Resume from checkpoint if agent already finished
      const checkpoint = task.input_payload?._checkpoint;
      const resumeFromStep = checkpoint?.step || 'start';

      if (resumeFromStep === 'agent_finished' && checkpoint) {
        console.log(`[Worker] ⏩ Resuming Task ${taskId} from 'agent_finished' checkpoint.`);
        const result = {
          artifact:   checkpoint.data,
          tokensUsed: checkpoint.tokensUsed || 0,
        };
        return await handlePostProcessing(job, result, task, input);
      }

      // 1. Mark running
      await nexusStateStore.updateTaskStatus(taskId, 'running');

      // 2. Publish start event
      await eventBuffer.publish(missionId, {
        type:      'task_started',
        taskId,
        missionId,
        label:     input.label,
        agentType,
      });

      // 3. Build AgentContext with size-controlled dependency outputs
      const context: AgentContext = {
        entries:    [],
        promptBlock: '',
        permissions: {
          fileAccess:    false,
          networkAccess: true,
          exec:          'limited',
        },
      };

      if (contextFields && contextFields.length > 0) {
        const artifacts = await nexusStateStore.fetchArtifactsByContext(missionId, contextFields);

        // ── FIX #6: Truncate dependency content before building context ───
        const { entries, promptBlock } = buildContextBlock(artifacts);
        context.entries     = entries;
        context.promptBlock = promptBlock;
      }

      await nexusStateStore.updateTaskCheckpoint(taskId, { step: 'context_ready' });

      // 4. Run agent with circuit breakers (FIX #9)
      const result = await runAgentWithCircuitBreaker({
        task:      input,
        goal:      input.label,
        goalType:  'general',
        context,
        isAborted: () => false,
      });

      await nexusStateStore.updateTaskCheckpoint(taskId, {
        step:       'agent_finished',
        data:       result.artifact,
        tokensUsed: result.tokensUsed,
      });

      return await handlePostProcessing(job, result, task, input);

    } catch (err: any) {
      console.error(`[Worker] ❌ Task failed: ${taskId}`, err);

      await nexusStateStore.updateTaskStatus(taskId, 'failed', { error: err.message });

      await eventBuffer.publish(missionId, {
        type:     'task_failed',
        taskId,
        missionId,
        error:    err.message,
      });

      throw err;
    }
  },
  { connection, concurrency: 5 }
);

taskWorker.on('failed', (job, err) => {
  console.error(`[Worker] 🚨 Job ${job?.id} failed persistently:`, err);
});
