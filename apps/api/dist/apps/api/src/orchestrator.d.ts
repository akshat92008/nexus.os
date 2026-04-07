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
import type { Response } from 'express';
import type { TaskDAG, TaskNode } from '../../../packages/types/index.js';
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
import { RateLimitGovernor } from './rateLimitGovernor.js';
export interface OrchestratorDeps {
    dag: TaskDAG;
    memory: MissionMemory;
    registry: TaskRegistry;
    governor: RateLimitGovernor;
    userId: string;
    sessionId: string;
    res: Response;
    isAborted: () => boolean;
}
export declare function computeExecutionWaves(nodes: TaskNode[]): TaskNode[][];
export declare function orchestrateDAG(deps: OrchestratorDeps): Promise<void>;
/**
 * Execute a single, isolated action (Integration Layer).
 * Triggered from "Next Actions" in the UI.
 */
export declare function executeSingleAction(actionId: string, workspaceId: string, userId: string, res: any, isAborted: () => boolean): Promise<void>;
//# sourceMappingURL=orchestrator.d.ts.map