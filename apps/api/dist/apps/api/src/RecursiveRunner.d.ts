/**
 * Nexus OS — Recursive Runner (Fractal Task Decomposition)
 *
 * This module addresses the "Complexity Scaling" problem by spawning
 * sub-orchestrators for complex tasks.
 */
import type { TaskNode, TaskDAG, MemoryEntry } from '../../../packages/types/index.js';
export declare class RecursiveRunner {
    /**
     * Identifies if a task needs fractal decomposition.
     */
    isComplex(task: TaskNode): boolean;
    /**
     * Spawns a sub-orchestrator for a complex task.
     */
    decompose(parentTask: TaskNode, parentGoal: string, contextBriefing: string): Promise<TaskDAG>;
    /**
     * Merges results from a sub-DAG into a single artifact.
     */
    synthesizeResults(subArtifacts: MemoryEntry[]): string;
}
export declare const recursiveRunner: RecursiveRunner;
//# sourceMappingURL=RecursiveRunner.d.ts.map