/**
 * Nexus OS — Agent Manager (Pillar 2 · Execution Engine)
 *
 * Orchestrates the two-phase execution pipeline:
 *
 *   Phase 1 — PARALLEL: All independent agents run simultaneously via
 *             Promise.allSettled(). This is the core latency optimization.
 *             A 4-agent parallel run takes the time of the SLOWEST
 *             single agent, not their sum.
 *
 *   Phase 2 — SEQUENTIAL: Synthesis agents run one after another.
 *             Each sequential agent receives the FULL MCP context
 *             (all parallel artifacts) so it can build on prior work.
 *
 * Every agent calls Groq's llama-3.1-8b-instant (fast, cheap, 8B params)
 * to generate a specialist artifact. Token counts are extracted from the
 * Groq response and forwarded to the ledger and MCP bridge.
 *
 * SSE event sequence per agent:
 *   agent_spawn → agent_working → artifact_deposited → ledger_update
 *
 * ── PATCH NOTES (Silent Hang Fix) ─────────────────────────────────────────
 *
 *  1. Promise.all → Promise.allSettled: A single unsettled promise in
 *     Promise.all blocks Phase 2 forever. allSettled guarantees Phase 1
 *     always terminates regardless of individual agent outcomes.
 *
 *  2. Per-agent timeout wrapper (withTimeout): Guards against network
 *     edge-cases, Groq slow-drip responses, or stream-write failures
 *     converting to unhandled AbortErrors that escape the try/catch.
 *     Each agent gets a hard 30 s wall-clock budget.
 *
 *  3. ledger.recordTransaction() race: The first call fires a dynamic
 *     import('@supabase/supabase-js') that can stall the microtask queue
 *     in certain Node.js versions. Racing it against a 5 s timeout
 *     ensures the agent's promise always resolves even when Supabase
 *     initialisation hangs.
 *
 *  4. try / catch / finally in orchestrate(): The `done` SSE event is
 *     emitted in the finally block so the frontend always receives a
 *     terminal signal — even on unexpected errors or 0-sequential tasks.
 */

import type { Response } from 'express';
import type {
  SubTask,
  ExecutionPlan,
  Artifact,
  AgentType,
  AgentSpawnEvent,
  AgentWorkingEvent,
  PlanReadyEvent,
  DoneEvent,
} from '../../../packages/types/index.js';
import type { MCPBridge } from './mcpBridge.js';
import { ledger } from './ledger.js';

// ── Constants ──────────────────────────────────────────────────────────────

const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const AGENT_MODEL   = 'llama-3.1-8b-instant';

/**
 * Hard wall-clock budget per agent (fetch timeout is 20 s inside, this is
 * the outer guard that catches anything fetch's AbortSignal misses).
 */
const AGENT_TIMEOUT_MS  = 30_000;

/**
 * Ledger write timeout — guards against the first-call dynamic import of
 * @supabase/supabase-js stalling the microtask queue.
 */
const LEDGER_TIMEOUT_MS = 5_000;

// ── Agent Persona Prompts ──────────────────────────────────────────────────

const AGENT_PERSONAS: Record<AgentType, string> = {
  researcher:
    'You are a Research Specialist. Produce dense, factual, source-structured research notes. ' +
    'Use bullet points and clear sections. Prioritize recency, credibility, and breadth.',
  analyst:
    'You are a Data & Business Analyst. Produce structured analysis with frameworks (SWOT, Porter\'s, etc.). ' +
    'Quantify where possible. Identify patterns, risks, and opportunities.',
  writer:
    'You are a Senior Content Strategist & Writer. Produce polished, publication-ready prose. ' +
    'Narrative flow, clear hierarchy, compelling opening. Adapt tone to context.',
  coder:
    'You are a Principal Software Engineer. Produce clean, typed, production-ready code. ' +
    'Include brief architecture rationale. Use best practices for the relevant language/framework.',
  strategist:
    'You are a McKinsey-level Management Strategist. Produce actionable strategic recommendations. ' +
    'Use structured frameworks. Include quick wins and long-term roadmap items.',
  summarizer:
    'You are an Executive Summarizer. Produce a crisp, board-level synthesis. ' +
    'Lead with the single most important insight. Follow with 3-5 key takeaways. End with a clear next step.',
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Races a promise against a timeout. Rejects with a descriptive error if the
 * timeout fires first — guaranteeing the returned promise always settles.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`[Timeout] "${label}" exceeded ${ms}ms wall-clock budget`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// ── SSE Emitter ────────────────────────────────────────────────────────────

function safeEmit(res: Response, event: object, isAborted: () => boolean): void {
  if (isAborted()) return;
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch (err) {
    // Socket may be closed — swallow silently; isAborted() will catch it next call.
    console.warn('[AgentManager] safeEmit swallowed write error:', err);
  }
}

// ── Groq Agent Invocation ──────────────────────────────────────────────────

async function runAgent(
  task: SubTask,
  mode: 'parallel' | 'sequential',
  context: Artifact[],
  mcpBridge: MCPBridge,
  userId: string,
  res: Response,
  isAborted: () => boolean
): Promise<Artifact> {
  const apiKey = process.env.GROQ_API_KEY!;

  const contextBlock =
    context.length > 0
      ? `\n\n═══ CONTEXT FROM PARALLEL AGENTS ═══\n` +
        context
          .map(
            (a) =>
              `[${a.agentType.toUpperCase()} — "${a.taskLabel}"]\n${a.content}`
          )
          .join('\n\n────────────────────────\n\n') +
        '\n═══ END CONTEXT ═══\n'
      : '';

  const systemPrompt =
    AGENT_PERSONAS[task.agentType] +
    `\n\nYou are operating inside Nexus OS as a sub-agent. ` +
    `Produce a high-quality artifact (max 500 words) that directly addresses your task. ` +
    `Be specific and immediately actionable. No meta-commentary or preamble.`;

  const userMessage =
    `Your assigned task: ${task.label}` +
    contextBlock +
    `\n\nProduce your specialist artifact now:`;

  safeEmit(res, {
    type:      'agent_working',
    taskId:    task.id,
    taskLabel: task.label,
    message:   `Agent [${task.agentType}] processing "${task.label}"...`,
  } satisfies AgentWorkingEvent, isAborted);

  // ── Groq Fetch ───────────────────────────────────────────────────────────
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       AGENT_MODEL,
      temperature: 0.65,
      max_tokens:  700,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(20_000), // Hard 20 s fetch timeout
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Agent ${task.id} Groq error (${response.status}): ${errText.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as any;
  const content: string = data?.choices?.[0]?.message?.content ?? '[No output generated]';

  const tokensUsed: number =
    (data?.usage?.completion_tokens ?? 0) + (data?.usage?.prompt_tokens ?? 0);

  const artifact: Artifact = {
    agentId:     task.id,
    taskLabel:   task.label,
    agentType:   task.agentType,
    content,
    tokensUsed,
    depositedAt: new Date().toISOString(),
  };

  // ── Deposit ───────────────────────────────────────────────────────────────
  // Synchronous — fires artifact_deposited SSE event.
  mcpBridge.deposit(task.id, artifact, res, isAborted);

  // ── Ledger ────────────────────────────────────────────────────────────────
  // FIX: Race against LEDGER_TIMEOUT_MS so a stalled Supabase dynamic-import
  // or hung network call can never prevent the agent's promise from settling.
  // The ledger still completes in the background; we just don't block on it.
  try {
    await withTimeout(
      ledger.recordTransaction(
        userId,
        task.id,
        task.label,
        task.agentType,
        tokensUsed,
        res,
        isAborted
      ),
      LEDGER_TIMEOUT_MS,
      `ledger.recordTransaction(${task.id})`
    );
  } catch (ledgerErr) {
    // Non-fatal — artifact is already deposited; billing can be reconciled later.
    console.warn(
      `[AgentManager] ⚠️  Ledger write timed out or failed for ${task.id}:`,
      ledgerErr instanceof Error ? ledgerErr.message : ledgerErr
    );
  }

  return artifact;
}

// ── Agent Manager Class ────────────────────────────────────────────────────

export class AgentManager {
  async spawn(
    task: SubTask,
    mode: 'parallel' | 'sequential',
    context: Artifact[],
    mcpBridge: MCPBridge,
    userId: string,
    res: Response,
    isAborted: () => boolean
  ): Promise<Artifact> {
    safeEmit(res, {
      type:      'agent_spawn',
      taskId:    task.id,
      taskLabel: task.label,
      agentType: task.agentType,
      mode,
    } satisfies AgentSpawnEvent, isAborted);

    console.log(
      `[AgentManager] 🤖 Spawning [${mode}] agent: ${task.id} (${task.agentType})`
    );

    try {
      return await runAgent(task, mode, context, mcpBridge, userId, res, isAborted);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AgentManager] ❌ Agent ${task.id} failed:`, message);

      safeEmit(res, {
        type:    'error',
        taskId:  task.id,
        message: `Agent execution failed: ${message}`,
      }, isAborted);

      // Return a placeholder so Promise.allSettled always has a fulfilled value.
      const placeholder: Artifact = {
        agentId:     task.id,
        taskLabel:   task.label,
        agentType:   task.agentType,
        content:     `[System Error] This agent failed to generate an artifact: ${message}`,
        tokensUsed:  0,
        depositedAt: new Date().toISOString(),
      };

      mcpBridge.deposit(task.id, placeholder, res, isAborted);
      return placeholder;
    }
  }
}

// ── Top-Level Orchestration ────────────────────────────────────────────────

export async function orchestrate(
  plan: ExecutionPlan,
  mcpBridge: MCPBridge,
  userId: string,
  sessionId: string,
  goal: string,
  res: Response,
  isAborted: () => boolean
): Promise<void> {
  const { parallel, sequential } = plan.plan;
  const manager  = new AgentManager();
  const startMs  = Date.now();
  let   phase1Ok = false;
  let   phase2Ok = false;

  mcpBridge.init(sessionId, goal);

  safeEmit(res, {
    type:            'plan_ready',
    parallelCount:   parallel.length,
    sequentialCount: sequential.length,
    tasks:           { parallel, sequential },
    estimatedFeeUsd: (parallel.length + sequential.length) * 0.01,
  } satisfies PlanReadyEvent, isAborted);

  console.log(
    `[Orchestrator] 🚦 Session ${sessionId} — ` +
    `${parallel.length} parallel + ${sequential.length} sequential tasks`
  );

  // ── Phase 1 — Parallel ───────────────────────────────────────────────────
  // FIX: Promise.allSettled instead of Promise.all.
  //   • allSettled always resolves — even if individual agents reject or timeout.
  //   • Each spawn is further wrapped in withTimeout() so a never-settling promise
  //     (e.g. a network edge-case that bypasses fetch's AbortSignal) cannot
  //     permanently block the Phase 1 gate.
  try {
    if (parallel.length > 0) {
      console.log('[Orchestrator] ⚡ Phase 1: Starting parallel agents...');

      const results = await Promise.allSettled(
        parallel.map((task) =>
          withTimeout(
            manager.spawn(task, 'parallel', [], mcpBridge, userId, res, isAborted),
            AGENT_TIMEOUT_MS,
            `parallel-agent:${task.id}`
          )
        )
      );

      // Log per-agent outcomes for observability.
      results.forEach((result, i) => {
        const taskId = parallel[i]?.id ?? `agent_${i}`;
        if (result.status === 'fulfilled') {
          console.log(`[Orchestrator] ✅ Phase 1 agent settled: ${taskId}`);
        } else {
          console.error(
            `[Orchestrator] ❌ Phase 1 agent failed (timeout or throw): ${taskId} —`,
            result.reason instanceof Error ? result.reason.message : result.reason
          );
        }
      });

      phase1Ok = true;
      console.log(
        `[Orchestrator] ✅ Phase 1 complete — ${mcpBridge.size} artifact(s) in MCP store.`
      );
    } else {
      phase1Ok = true;
      console.log('[Orchestrator] ⏭  Phase 1 skipped — no parallel tasks.');
    }
  } catch (phase1Err) {
    // Should not be reachable (allSettled never rejects) but is here as a
    // last-resort safety net so Phase 2 still runs.
    console.error('[Orchestrator] 💥 Unexpected Phase 1 error:', phase1Err);
  }

  // ── Phase 2 — Sequential ─────────────────────────────────────────────────
  // FIX: Phase 2 is now ALWAYS attempted regardless of Phase 1 outcome.
  //     Each sequential agent is also wrapped in withTimeout().
  try {
    if (sequential.length > 0) {
      console.log('[Orchestrator] 🔗 Phase 2: Starting sequential agents...');

      for (const task of sequential) {
        try {
          mcpBridge.announceHandoff(task.id, res, isAborted);
          const context = mcpBridge.retrieveAll();

          await withTimeout(
            manager.spawn(task, 'sequential', context, mcpBridge, userId, res, isAborted),
            AGENT_TIMEOUT_MS,
            `sequential-agent:${task.id}`
          );

          console.log(`[Orchestrator] ✅ Sequential agent done: ${task.id}`);
        } catch (agentErr) {
          // One sequential agent failing must not abort the rest of the pipeline.
          console.error(
            `[Orchestrator] ❌ Sequential agent timed out or threw: ${task.id} —`,
            agentErr instanceof Error ? agentErr.message : agentErr
          );
        }
      }

      phase2Ok = true;
      console.log('[Orchestrator] ✅ Phase 2 complete.');
    } else {
      phase2Ok = true;
      console.log('[Orchestrator] ⏭  Phase 2 skipped — no sequential tasks.');
    }
  } catch (phase2Err) {
    console.error('[Orchestrator] 💥 Unexpected Phase 2 error:', phase2Err);
  } finally {
    // ── Done event — GUARANTEED ────────────────────────────────────────────
    // FIX: Emitting `done` inside finally means it fires unconditionally:
    //   • 0 sequential tasks  ✓
    //   • Phase 1 or 2 errors ✓
    //   • Client disconnected  ✓ (safeEmit guards the write)
    //
    // This is the signal the frontend needs to stop its spinner and unlock
    // the export button. Without it the UI hangs indefinitely.
    const totalAgents   = parallel.length + sequential.length;
    const totalFeeUsd   = ledger.getCumulativeFee(userId);
    const totalTokens   = mcpBridge
      .retrieveAll()
      .reduce((sum, a) => sum + a.tokensUsed, 0);
    const durationMs    = Date.now() - startMs;
    const allSucceeded  = phase1Ok && phase2Ok;

    safeEmit(res, {
      type:            'done',
      message:         allSucceeded
        ? `All ${totalAgents} agent(s) completed successfully.`
        : `Workflow finished with errors after ${durationMs}ms. Check server logs.`,
      totalAgents,
      totalFeeUsd,
      totalTokensUsed: totalTokens,
      userId,
      sessionId,
      durationMs,
    } satisfies DoneEvent, isAborted);

    console.log(
      `[Orchestrator] 🏁 Done — ${totalAgents} agent(s) · ` +
      `$${totalFeeUsd.toFixed(4)} · ${durationMs}ms · ` +
      `phase1=${phase1Ok} phase2=${phase2Ok}`
    );
  }
}
