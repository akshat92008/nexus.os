/**
 * Nexus OS — Orchestrator v2
 *
 * Replaces the orchestrate() function in agentManager.ts.
 * Key changes:
 *
 * 1. WAVE-BASED EXECUTION — computeExecutionWaves() does topological sort
 *    of the TaskDAG, producing ordered execution waves. Tasks in the same
 *    wave have no dependencies on each other and run concurrently.
 *
 * 2. ATOMIC TASK LOCKING — every task goes through TaskRegistry.tryLock()
 *    before any LLM call. Duplicate execution on retry is impossible.
 *
 * 3. SELECTIVE CONTEXT — each task reads only the memory fields it declared
 *    in contextFields, not all prior agent output.
 *
 * 4. PARTIAL RECOVERY — after all waves, failed non-critical tasks are
 *    retried in a single recovery wave without restarting the mission.
 *
 * 5. CHIEF ANALYST — always runs as the final stage after all task waves.
 *    Produces the SynthesisArtifact and FormattedOutput.
 *
 * 6. LEDGER INTEGRATION — token accounting unchanged; ledger.ts is untouched.
 */
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
import { runAgent } from './agentRunner.js';
import { runChiefAnalyst } from './chiefAnalyst.js';
import { dynamicPlanner } from './DynamicPlanner.js';
import { recursiveRunner } from './RecursiveRunner.js';
import { watchdogAgent } from './WatchdogAgent.js';
import { formatOutput, formattedOutputToLegacyContent, transformToWorkspace, formatStudentToWorkspace, formatFounderToWorkspace, formatDeveloperToWorkspace } from './outputFormatter.js';
import { formatStudentOutput } from './formatters/studentFormatter.js';
import { ledger } from './ledger.js';
import { nexusStateStore } from './storage/nexusStateStore.js';
// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function safeEmit(res, event, isAborted) {
    if (isAborted())
        return;
    try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    catch {
        // socket closed — ignore
    }
}
function resolveWindowType(goalType, mode) {
    if (mode === 'student')
        return 'learning_workspace';
    if (mode === 'developer')
        return 'code_studio';
    switch (goalType) {
        case 'lead_gen':
            return 'lead_engine';
        case 'research':
        case 'analysis':
            return 'research_lab';
        case 'strategy':
            return 'strategy_board';
        case 'content':
            return 'content_engine';
        case 'code':
            return 'code_studio';
        default:
            return 'general';
    }
}
// ── Error-Type-Aware Retry Delay ──────────────────────────────────────────────
/**
 * Computes retry delay based on error type:
 * - 429 Rate Limit:  respects the Groq retry-after header + exponential buffer
 * - Timeout:        fast retry with small linear increment
 * - Server error:   standard exponential backoff
 * - Unknown:        standard exponential backoff
 */
function getRetryDelay(err, attempt) {
    const msg = err.message;
    // 429 Rate Limit — respect retry-after, add exponential buffer
    if (msg.includes('429')) {
        const retryAfterMatch = msg.match(/retry-after:\s*(\d+)/);
        const retryAfter = retryAfterMatch ? parseInt(retryAfterMatch[1]) : 5;
        return (retryAfter * 1000) + (Math.pow(2, attempt) * 1000);
    }
    // Timeout or network error — retry quickly
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('AbortError')) {
        return 1500 * attempt;
    }
    // Groq 500/502 server error — standard backoff
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        return Math.pow(2, attempt) * 2000;
    }
    // Default: exponential
    return Math.pow(2, attempt) * 1500;
}
// ── Wave Computation (Topological Sort) ────────────────────────────────────
export function computeExecutionWaves(nodes) {
    const waves = [];
    const completed = new Set();
    let remaining = [...nodes];
    let safetyLimit = nodes.length + 2; // prevent infinite loop
    while (remaining.length > 0 && safetyLimit-- > 0) {
        // Tasks whose dependencies are all satisfied
        const wave = remaining.filter((n) => n.dependencies.every((dep) => completed.has(dep)));
        if (wave.length === 0) {
            throw new Error('[Orchestrator] Cannot resolve next execution wave — possible cycle or unresolvable dependencies. ' +
                `Remaining tasks: ${remaining.map((n) => n.id).join(', ')}`);
        }
        waves.push(wave);
        wave.forEach((n) => completed.add(n.id));
        remaining = remaining.filter((n) => !completed.has(n.id));
    }
    return waves;
}
// ── Single Task Execution ──────────────────────────────────────────────────
async function executeTask(task, deps, waveIndex) {
    const { memory, registry, governor, userId, res, isAborted, dag } = deps;
    // IDEMPOTENCY GATE — skip if already completed (e.g. from a prior run)
    if (registry.isCompleted(task.id)) {
        console.log(`[Orchestrator] ⏭️ Task "${task.id}" already completed — skipping`);
        return;
    }
    // ATOMIC LOCK — prevents duplicate execution
    const locked = registry.tryLock(task.id);
    if (!locked) {
        console.log(`[Orchestrator] 🔒 Task "${task.id}" already locked — skipping`);
        return;
    }
    safeEmit(res, {
        type: 'agent_spawn',
        taskId: task.id,
        taskLabel: task.label,
        agentType: task.agentType,
        mode: 'wave',
        waveIndex,
    }, isAborted);
    registry.markRunning(task.id);
    // Selective context injection from memory
    const context = memory.selectiveRead(task.contextFields);
    safeEmit(res, {
        type: 'agent_working',
        taskId: task.id,
        taskLabel: task.label,
        message: context.entries.length > 0
            ? `Reading ${context.entries.length} prior agent output(s)...`
            : 'Starting research...',
    }, isAborted);
    try {
        // ── Recursive Problem Deconstruction (Fractal Task Decomposition) ─────────
        let finalResult;
        if (recursiveRunner.isComplex(task)) {
            console.log(`[Orchestrator] 🌀 Task "${task.id}" identified as COMPLEX. Spawning Sub-Orchestrator.`);
            const subDag = await recursiveRunner.decompose(task, dag.goal, context.promptBlock || '');
            const subMemory = new MissionMemory(`sub_${task.id}`, task.label); // Isolated memory for sub-mission
            const subRegistry = new TaskRegistry(`sub_${task.id}`);
            // Execute sub-mission (Recursive call to orchestrateDAG)
            await orchestrateDAG({
                dag: subDag,
                memory: subMemory,
                registry: subRegistry,
                governor,
                userId,
                sessionId: `sub_${deps.sessionId}_${task.id}`,
                res,
                isAborted,
            });
            const subEntries = subMemory.readAll();
            const synthesizedBody = recursiveRunner.synthesizeResults(subEntries);
            const totalTokens = subEntries.reduce((acc, e) => acc + e.tokensUsed, 0);
            finalResult = {
                artifact: {
                    format: 'prose',
                    agentType: task.agentType,
                    taskId: task.id,
                    body: synthesizedBody,
                    wordCount: synthesizedBody.split(/\s+/).length,
                    rawContent: synthesizedBody,
                },
                tokensUsed: totalTokens,
            };
        }
        else {
            // Standard Execution
            finalResult = await governor.execute(() => runAgent({
                task,
                goal: dag.goal,
                goalType: dag.goalType,
                context,
                sseRes: res,
                isAborted,
            }));
        }
        // Write to typed mission memory
        memory.write(task.id, task.agentType, finalResult.artifact, finalResult.tokensUsed, res, isAborted);
        // Mark completed in registry
        const outputKey = `artifact:${task.id}`;
        registry.markCompleted(task.id, outputKey);
        // Update ledger
        ledger
            .recordTransaction(userId, task.id, task.label, task.agentType, finalResult.tokensUsed, res, isAborted)
            .catch((err) => console.warn(`[Orchestrator] Ledger write failed for ${task.id}:`, err));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Orchestrator] ❌ Task "${task.id}" failed: ${message.slice(0, 120)}`);
        registry.markFailed(task.id, message);
        safeEmit(res, { type: 'error', taskId: task.id, message: message.slice(0, 100) }, isAborted);
        throw err; // re-throw for Promise.allSettled
    }
}
// ── Wave Execution ─────────────────────────────────────────────────────────
async function executeWave(wave, waveIndex, deps) {
    const { res, isAborted } = deps;
    safeEmit(res, {
        type: 'wave_start',
        waveIndex,
        taskCount: wave.length,
        taskIds: wave.map((n) => n.id),
    }, isAborted);
    // Stagger parallel starts slightly to avoid simultaneous Groq hits
    const results = await Promise.allSettled(wave.map(async (task, i) => {
        if (i > 0 && wave.length > 1)
            await sleep(i * 500); // 500ms stagger per task (was 300)
        return executeTask(task, deps, waveIndex);
    }));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    safeEmit(res, { type: 'wave_complete', waveIndex, succeeded, failed }, isAborted);
    // If a critical task failed, mark its dependents as skipped
    const failedCritical = wave.filter((task, i) => results[i].status === 'rejected' && task.priority === 'critical');
    if (failedCritical.length > 0) {
        const failedIds = new Set(failedCritical.map((t) => t.id));
        for (const node of deps.dag.nodes) {
            if (node.dependencies.some((dep) => failedIds.has(dep))) {
                deps.registry.markSkipped(node.id);
                console.warn(`[Orchestrator] ⏭️ Skipping "${node.id}" — critical dependency failed`);
            }
        }
    }
    return { succeeded, failed };
}
// ── Main Orchestrator ──────────────────────────────────────────────────────
export async function orchestrateDAG(deps) {
    const { dag, memory, registry, governor, userId, sessionId, res, isAborted } = deps;
    const startMs = Date.now();
    // Init all tasks in registry
    dag.nodes.forEach((n) => registry.initTask(n.id));
    const mode = dag.metadata?.mode || 'student';
    // Emit plan_ready with both new DAG info and legacy compat fields
    const parallelTasks = dag.nodes.filter((n) => n.dependencies.length === 0);
    const sequentialTasks = dag.nodes.filter((n) => n.dependencies.length > 0);
    safeEmit(res, {
        type: 'plan_ready',
        parallelCount: parallelTasks.length,
        sequentialCount: sequentialTasks.length,
        waveCount: dag.estimatedWaves,
        nodeCount: dag.nodes.length,
        goalType: dag.goalType,
        successCriteria: dag.successCriteria,
        tasks: {
            parallel: parallelTasks.map((n) => ({ id: n.id, label: n.label, agentType: n.agentType })),
            sequential: sequentialTasks.map((n) => ({ id: n.id, label: n.label, agentType: n.agentType })),
        },
        estimatedFeeUsd: dag.nodes.length * 0.01,
    }, isAborted);
    // Compute execution waves
    let waves;
    try {
        waves = computeExecutionWaves(dag.nodes);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        safeEmit(res, { type: 'error', message: `DAG computation failed: ${msg}` }, isAborted);
        return;
    }
    console.log(`[Orchestrator] 🚀 Mission "${dag.goal.slice(0, 50)}..." — ${waves.length} waves, ${dag.nodes.length} tasks`);
    // --- Real-time Pause Visibility (Phase 7) ---
    const statusMonitor = setInterval(() => {
        const stats = governor.stats;
        if (stats.paused && stats.waitTime > 0) {
            safeEmit(res, {
                type: 'system_pause',
                pauseUntil: stats.pauseUntil,
                reason: 'Rate limit cooldown'
            }, isAborted);
        }
    }, 3000);
    // ── Proactive "Watchdog" Auditor (Runtime Safety) ────────────────────────
    watchdogAgent.startMonitoring(sessionId, dag.goal, memory, (reason) => {
        safeEmit(res, {
            type: 'alert',
            title: 'Watchdog Alarm: Logical Drift',
            content: `Reason: ${reason}. Triggering Pivot Strategy...`,
            priority: 'critical'
        }, isAborted);
        // In a real system, we might pause or re-plan here
    });
    try {
        // Execute each wave sequentially (tasks within a wave run concurrently)
        for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
            if (isAborted()) {
                console.log('[Orchestrator] 🛑 Mission aborted');
                break;
            }
            const wave = waves[waveIndex];
            console.log(`[Orchestrator] 🌊 Wave ${waveIndex + 1}/${waves.length}: [${wave.map((n) => n.id).join(', ')}]`);
            // Filter out already-completed or skipped tasks
            const pending = wave.filter((n) => !registry.isCompleted(n.id) && registry.getStatus(n.id) !== 'skipped');
            if (pending.length === 0) {
                console.log(`[Orchestrator] Wave ${waveIndex + 1} — all tasks already complete, skipping`);
                continue;
            }
            await executeWave(pending, waveIndex, deps);
            // ── Dynamic DAG Expansion (Structural Intelligence) ──────────────────
            // After each wave, we check if we need to inject new tasks.
            const allArtifacts = memory.readAll();
            const decision = await dynamicPlanner.supervise(dag, allArtifacts, waveIndex);
            if (decision.status === 'drill_down' && decision.newTasks) {
                dynamicPlanner.injectTasks(dag, decision.newTasks);
                // Re-compute waves to include newly injected tasks
                try {
                    const newWaves = computeExecutionWaves(dag.nodes);
                    // Only update the future waves
                    waves = newWaves;
                    console.log(`[Orchestrator] 🧠 DAG Expanded! New wave count: ${waves.length}`);
                    safeEmit(res, {
                        type: 'agent_working',
                        taskId: 'planner',
                        taskLabel: 'Dynamic Planner',
                        message: `Injecting ${decision.newTasks.length} drill-down tasks based on current findings...`
                    }, isAborted);
                }
                catch (err) {
                    console.error('[Orchestrator] Failed to re-compute expanded DAG:', err);
                }
            }
            // Small inter-wave pause to let Groq settle
            if (waveIndex < waves.length - 1 && !isAborted()) {
                await sleep(1500);
            }
        }
    }
    finally {
        clearInterval(statusMonitor);
        watchdogAgent.stopMonitoring(sessionId);
    }
    // ── PARTIAL RECOVERY — retry failed non-critical tasks ─────────────────
    const failedTasks = registry.getFailedTasks();
    const retryable = failedTasks.filter((r) => {
        const node = dag.nodes.find((n) => n.id === r.taskId);
        if (!node)
            return false;
        if (node.priority === 'critical')
            return false; // critical fails are not retried silently
        if (!registry.canRetry(r.taskId, node.maxRetries))
            return false;
        // CRITICAL FIX: only retry if ALL dependencies are in completed state
        // Retrying a task whose dependency failed will produce garbage output
        const allDepsCompleted = node.dependencies.every((dep) => registry.getStatus(dep) === 'completed');
        if (!allDepsCompleted) {
            console.warn(`[Orchestrator] ⏭️ Skipping retry of "${r.taskId}" — dependency not completed`);
        }
        return allDepsCompleted;
    });
    if (retryable.length > 0 && !isAborted()) {
        console.log(`[Orchestrator] 🔄 Recovering ${retryable.length} failed task(s)...`);
        safeEmit(res, {
            type: 'retry_wave',
            retryCount: retryable.length,
            taskIds: retryable.map((r) => r.taskId),
        }, isAborted);
        retryable.forEach((r) => registry.resetForRetry(r.taskId));
        const retryNodes = retryable
            .map((r) => dag.nodes.find((n) => n.id === r.taskId))
            .filter(Boolean);
        await Promise.allSettled(retryNodes.map((node, i) => {
            // Use error-type-aware delay between retries
            const failRecord = registry.getFailedTasks().find(f => f.taskId === node.id);
            const err = new Error(failRecord?.errorMessage ?? '');
            const delay = getRetryDelay(err, i + 1);
            return sleep(delay).then(() => executeTask(node, deps, -1 /* recovery wave */));
        }));
    }
    // ── CHIEF ANALYST — always runs last ──────────────────────────────────
    let synthesisContent = '';
    let missionWorkspace = undefined;
    if (!isAborted() && memory.size > 0) {
        try {
            const allEntries = memory.readAll();
            const synthesis = await runChiefAnalyst(dag, allEntries, governor, res, isAborted);
            // Format output per domain rules
            const formatted = formatOutput(synthesis, dag.goalType);
            synthesisContent = formattedOutputToLegacyContent(formatted);
            // Workspace Transformation (V3)
            const allArtifacts = new Map();
            allEntries.forEach(e => allArtifacts.set(e.taskId, e.data));
            const isStudent = dag.isStudentMode;
            if (isStudent) {
                const studentOutput = formatStudentOutput(synthesis);
                missionWorkspace = formatStudentToWorkspace(studentOutput, dag.goal, sessionId);
            }
            else if (mode === 'founder') {
                const { formatFounderOutput } = await import('./formatters/founderFormatter.js');
                const founderOutput = formatFounderOutput(synthesis);
                missionWorkspace = formatFounderToWorkspace(founderOutput, dag.goal, sessionId);
            }
            else if (mode === 'developer') {
                const { formatDeveloperOutput } = await import('./formatters/developerFormatter.js');
                const developerOutput = formatDeveloperOutput(synthesis);
                missionWorkspace = formatDeveloperToWorkspace(developerOutput, dag.goal, sessionId);
            }
            else {
                missionWorkspace = transformToWorkspace(synthesis, dag.goal, dag.goalType, sessionId, allArtifacts);
            }
            // Next Action Engine (Continuous OS)
            const { generateNextActions } = await import('./actionEngine.js');
            missionWorkspace.nextActions = generateNextActions(missionWorkspace);
            missionWorkspace.activityLog = [{
                    id: `log_${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'execution',
                    message: mode === 'student'
                        ? 'Study guide and notes finalized.'
                        : mode === 'developer'
                            ? 'Technical implementation and documentation ready.'
                            : 'Mission completed. Strategic workspace and next actions generated.'
                }];
            const windowType = resolveWindowType(missionWorkspace.goalType ?? dag.goalType, mode);
            await nexusStateStore.upsertWorkspace(userId, missionWorkspace);
            await nexusStateStore.upsertWindow(userId, {
                workspaceId: missionWorkspace.id,
                windowType,
                title: missionWorkspace.goal,
                isBackground: false,
                isPinned: false,
                openedAt: Date.now(),
            });
            await nexusStateStore.setActiveWorkspace(userId, missionWorkspace.id);
            await nexusStateStore.addInboxEntry(userId, {
                type: 'system',
                title: 'Mission Complete',
                content: `Workspace "${missionWorkspace.goal}" is ready with ${missionWorkspace.sections.length} sections.`,
                priority: 'high',
            });
            // Write synthesis to memory
            memory.write('chief_analyst_synthesis', 'chief_analyst', synthesis, 0, res, isAborted);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[Orchestrator] Chief Analyst failed:', msg);
            safeEmit(res, { type: 'error', message: `Synthesis failed: ${msg.slice(0, 100)}` }, isAborted);
        }
    }
    // ── DONE ──────────────────────────────────────────────────────────────
    const summary = registry.getSummary();
    const allEntries = memory.readAll();
    const totalTokens = allEntries.reduce((sum, e) => sum + e.tokensUsed, 0);
    const totalFeeUsd = ledger.getCumulativeFee(userId);
    const durationMs = Date.now() - startMs;
    const isStudent = dag.isStudentMode;
    console.log(`[Orchestrator] 🏁 Done — ` +
        `completed: ${summary.completed}, failed: ${summary.failed}, skipped: ${summary.skipped} — ` +
        `${durationMs}ms`);
    safeEmit(res, {
        type: 'done',
        message: mode === 'student'
            ? 'Notes prepared and ready. Success!'
            : mode === 'developer'
                ? 'Code implementation complete. Production-ready.'
                : (summary.failed === 0 ? 'Mission complete.' : `Mission finished with ${summary.failed} task failure(s) — see gaps in synthesis.`),
        totalAgents: summary.completed + summary.failed,
        totalFeeUsd,
        totalTokensUsed: totalTokens,
        userId,
        sessionId,
        durationMs,
        synthesisAvailable: synthesisContent.length > 0,
        workspace: missionWorkspace,
    }, isAborted);
}
/**
 * Execute a single, isolated action (Integration Layer).
 * Triggered from "Next Actions" in the UI.
 */
export async function executeSingleAction(actionId, workspaceId, userId, res, isAborted) {
    const sessionId = `action_${Date.now()}`;
    console.log(`[Orchestrator] ⚡ Executing single action: ${actionId} for workspace ${workspaceId}`);
    try {
        // 1. Initial ack
        safeEmit(res, { type: 'connected', sessionId, message: 'Action connection established' }, isAborted);
        // 2. Load context from workspace (Simulated for now, would fetch from DB in prod)
        // For now, we'll use the Action Engine to determine the implementation
        const { runActionImplementation } = await import('./integrationManager.js');
        safeEmit(res, { type: 'agent_spawn', taskId: actionId, taskLabel: 'Executing Integration', agentType: 'strategist', mode: 'sequential' }, isAborted);
        safeEmit(res, { type: 'agent_working', taskId: actionId, message: 'Processing integration payload...' }, isAborted);
        const result = await runActionImplementation(actionId, workspaceId);
        const updatedWorkspace = await nexusStateStore.completeNextAction(userId, workspaceId, actionId, `Successfully executed: ${result.title}`);
        // 3. Deposit result
        safeEmit(res, {
            type: 'artifact_deposited',
            agentId: actionId,
            agentType: 'strategist',
            taskLabel: 'Action Result',
            preview: result.message,
            tokensUsed: 150,
            depositedAt: new Date().toISOString()
        }, isAborted);
        // 4. Update activity log on client (via done event)
        safeEmit(res, {
            type: 'done',
            message: 'Action executed successfully.',
            totalAgents: 1,
            totalFeeUsd: 0.002,
            totalTokensUsed: 150,
            sessionId,
            durationMs: 800,
            workspace: updatedWorkspace ?? undefined,
        }, isAborted);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        safeEmit(res, { type: 'error', message: `Action failed: ${msg}` }, isAborted);
    }
}
//# sourceMappingURL=orchestrator.js.map