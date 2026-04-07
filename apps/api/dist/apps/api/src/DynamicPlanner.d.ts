/**
 * Nexus OS — Dynamic Planner (Autonomous Reasoning Engine)
 *
 * This module enables "Dynamic Intelligence" by allowing the orchestrator
 * to re-evaluate the TaskDAG after each wave.
 */
import type { TaskDAG, TaskNode, MemoryEntry } from '../../../packages/types/index.js';
interface SupervisorDecision {
    status: 'proceed' | 'drill_down' | 'pivot';
    reasoning: string;
    newTasks?: TaskNode[];
}
export declare class DynamicPlanner {
    /**
     * Reviews the current mission state and decides if we need to expand the DAG.
     */
    supervise(dag: TaskDAG, artifacts: MemoryEntry[], waveIndex: number): Promise<SupervisorDecision>;
    injectTasks(dag: TaskDAG, newTasks: TaskNode[]): void;
}
export declare const dynamicPlanner: DynamicPlanner;
export {};
//# sourceMappingURL=DynamicPlanner.d.ts.map