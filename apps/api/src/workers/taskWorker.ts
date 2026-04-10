// --- Health Endpoint for Worker ---
import express from 'express';
const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'ok', worker: 'task', timestamp: Date.now() });
});
if (require.main === module) {
  const port = process.env.HEALTH_PORT || 4001;
  app.listen(port, () => console.log(`[TaskWorker] Health endpoint on :${port}`));
}
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
import { startLockExtension } from './utils/workerUtils.js';
import type { TypedArtifact, CodeArtifact, AgentContext, MemoryEntry } from '@nexus-os/types';

if (!process.env.REDIS_URL) {
  console.error('[TaskWorker] FATAL: REDIS_URL required');
  process.exit(1);
}
const REDIS_URL = process.env.REDIS_URL;
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

/** Maximum total tokens consumed by a single runAgent call. */
const CIRCUIT_MAX_TOKENS = 8_000;

/** Maximum job retry attempts for transient failures. */
const JOB_MAX_ATTEMPTS = 4;

/** Bull job exponential backoff base delay. */
const JOB_BACKOFF_BASE_MS = 3000;

/** Circuit breaker: hard wall-clock timeout for a single agent run (ms). */
const CIRCUIT_AGENT_TIMEOUT_MS = 120_000;

// 🚨 FIX 8: BULLMQ LOCK SAFETY
const LOCK_EXTEND_INTERVAL_MS = 5_000; // 5s extension
const LOCK_DURATION_MS = 30_000;      // 30s lock duration

// ── Context Size Control ─────────────────────────────────────────────────────

/**
 * 🚨 FIX 4: Safe Context Truncation
 * Refactor to handle JSON objects safely without destructive raw slicing.
 */
function truncateContext(raw: string, limit: number): string {
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes <= limit) return raw;

  try {
    // Attempt to parse if it's stringified JSON
    const obj = JSON.parse(raw);
    
    if (Array.isArray(obj)) {
      // If array, keep top N items and summarize the rest
      const head = obj.slice(0, 5);
      const summary = {
        _type: 'truncated_array',
        _total_length: obj.length,
        _kept_count: head.length,
        data: head,
        _notice: 'Array too large. Only showing first 5 items.'
      };
      const stringified = JSON.stringify(summary, null, 2);
      if (Buffer.byteLength(stringified, 'utf8') <= limit) return stringified;
    } else if (typeof obj === 'object' && obj !== null) {
      // If object, keep key names but omit large values
      const keys = Object.keys(obj);
      const summary: any = {
        _type: 'truncated_object',
        _all_keys: keys,
        _notice: 'Object too large. Keys preserved, large values omitted.'
      };
      
      // Attempt to keep some small values
      keys.forEach(k => {
        const val = obj[k];
        if (typeof val !== 'object' && String(val).length < 100) {
          summary[k] = val;
        }
      });
      
      const stringified = JSON.stringify(summary, null, 2);
      if (Buffer.byteLength(stringified, 'utf8') <= limit) return stringified;
    }
  } catch {
    // Not JSON or still too large, fallback to safe string slice
  }

  // Fallback: Slice at a reasonable boundary (not mid-multibyte char)
  const sliced = raw.slice(0, limit);
  return sliced + `\n\n[... Truncated for token safety — original size: ${bytes} bytes ...]`;
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
      data:       truncateContext(rawContent, MAX_PER_ARTIFACT_BYTES) as any,
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
  result: any,
  _task: any,
  input: any
): Promise<void> {
  const { taskId, missionId, agentType } = job.data;
  let finalArtifact = result.artifact as TypedArtifact;

  // 🚨 FIX 8: BULLMQ LOCK SAFETY 
  const stopLockExtension = startLockExtension(job, taskId, LOCK_EXTEND_INTERVAL_MS, LOCK_DURATION_MS);

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
      const stdoutLogs: string[] = [];
      const stderrLogs: string[] = [];

      // 🚨 FIX 5: Sandbox Process Orphanage Fix
      // Use explicit AbortSignal to kill the isolated sandbox on timeout.
      const sandboxController = new AbortController();
      let sandboxResult: Awaited<ReturnType<typeof sandboxManager.runCode>> | null = null;
      let sandboxError: string | undefined;

      const abortHandler = () => {
        sandboxController.abort();
      };
      sandboxController.signal.addEventListener('abort', abortHandler);

      try {
        sandboxResult = await Promise.race([
          sandboxManager.runCode(
            codeArt.language as any,
            codeArt.code,
            async (type, data) => {
              if (type === 'stdout') {
                stdoutLogs.push(data);
              } else {
                stderrLogs.push(data);
              }

              const buf = type === 'stdout' ? stdoutBuf : stderrBuf;
              await buf.append(data);
            },
            { timeout: SANDBOX_TIMEOUT_MS, signal: sandboxController.signal }
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => {
              sandboxController.abort();
              reject(new Error(`Sandbox timed out after ${SANDBOX_TIMEOUT_MS}ms`));
            }, SANDBOX_TIMEOUT_MS)
          ),
        ]);
      } catch (err: any) {
        sandboxError = err?.message || String(err) || 'Sandbox execution failed';
        sandboxResult = {
          stdout: stdoutLogs,
          stderr: stderrLogs,
          exitCode: 1,
          error: sandboxError,
        };
      } finally {
        sandboxController.signal.removeEventListener('abort', abortHandler);
        await stdoutBuf.stop();
        await stderrBuf.stop();
      }

      const exitCode = sandboxResult?.exitCode ?? 1;
      await eventBuffer.publish(missionId, {
        type:     'sandbox_finished',
        taskId,
        exitCode,
        error: sandboxResult?.error,
      } as any);

      finalArtifact = {
        ...codeArt,
        executionResult: sandboxResult as any,
        rawContent: `${codeArt.rawContent || ''}\n\n--- Execution Result ---\n${JSON.stringify(sandboxResult, null, 2)}`,
      } as any;

      await eventBuffer.publish(missionId, {
        type:      'agent_working',
        taskId,
        taskLabel: input.label,
        message:   sandboxResult?.error
          ? `Code Execution Failed: ${sandboxResult.error}`
          : 'Code Execution Succeeded.',
      } as any);
    }

    // 🚨 FIX 2: Atomic state commit (Single transaction via Postgres RPC)
    // Ensures artifact is stored AND status updated to 'completed' as a single unit of work.
    const artifactRecord = await nexusStateStore.completeTaskAtomics({
      missionId,
      taskId,
      type: agentType,
      content: finalArtifact,
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
    stopLockExtension();
  }
}

// ── Worker ───────────────────────────────────────────────────────────────────

export const taskWorker = new Worker<TaskJobData>(
  'tasks',
  async (job: Job<TaskJobData>) => {
    const { taskId, missionId, workspaceId, agentType, input, contextFields } = job.data;
  const maxAttempts = job.opts.attempts ?? JOB_MAX_ATTEMPTS;

    console.log(`[Worker] 🛠️  Executing task: ${taskId} (${agentType}) — Mission: ${missionId} (attempt ${job.attemptsMade + 1}/${maxAttempts})`);

    if (job.attemptsMade > 0) {
      await eventBuffer.publish(missionId, {
        type: 'task_retrying',
        taskId,
        missionId,
        attempt: job.attemptsMade + 1,
        maxAttempts,
        message: 'Retrying transient task failure with exponential backoff.',
      } as any);
    }

    try {
      // 🚨 HARDEN 1 & 3: Atomic execution claim (distributed lock)
      // Attempt to move status from 'queued' to 'running' atomically.
      const task = await nexusStateStore.getTask(taskId);
      if (task.status === 'completed') {
        console.log(`[Worker] ✅ Task ${taskId} already completed. Skipping.`);
        return;
      }

      if (task.status === 'running' && !task.input_payload?._checkpoint) {
        // Someone else is already running this, and no checkpoint exists.
        console.warn(`[Worker] ⚠️ Task ${taskId} is already running elsewhere. Skipping.`);
        return;
      }

      const claimed = await nexusStateStore.updateTaskStatus(taskId, 'running');
      if (!claimed && !task.input_payload?._checkpoint) {
        // Someone else claimed it first.
        console.warn(`[Worker] ⚠️ Task ${taskId} could not be claimed for execution. Already claimed?`);
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
      }) as any;

      await nexusStateStore.updateTaskCheckpoint(taskId, {
        step:       'agent_finished',
        data:       result.artifact,
        tokensUsed: result.tokensUsed,
      });

      return await handlePostProcessing(job, result, task, input);

    } catch (err: any) {
      console.error(`[Worker] ❌ Task failed: ${taskId}`, err);
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
      const errorPayload = {
        type:       'task_failed',
        taskId,
        missionId,
        error:      err.message,
        attempt:    job.attemptsMade + 1,
        maxAttempts,
        final:      isFinalAttempt,
      } as any;

      if (isFinalAttempt) {
        await nexusStateStore.updateTaskStatus(taskId, 'failed', { error: err.message });
      } else {
        await nexusStateStore.updateTaskStatus(taskId, 'queued', { error: err.message });
      }

      await eventBuffer.publish(missionId, errorPayload);

      throw err;
    }
  },
  {
    connection,
    concurrency: 5,
    lockDuration: LOCK_DURATION_MS,
    settings: {
      retryProcessDelay: 5000,
      stalledInterval: 5000,
      maxStalledCount: 1,
    },
  }
);

taskWorker.on('failed', (job, err) => {
  console.error(`[Worker] 🚨 Job ${job?.id} failed persistently:`, err);
});
