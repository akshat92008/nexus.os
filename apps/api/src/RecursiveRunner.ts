/**
 * Nexus OS — Recursive Runner (Fractal Task Decomposition)
 *
 * This module addresses the "Complexity Scaling" problem by spawning
 * sub-orchestrators for complex tasks.
 */

import type { TaskNode, TaskDAG, MemoryEntry } from '@nexus-os/types';

import { 
  MODEL_POWER 
} from './agents/agentConfig.js';
import { llmRouter } from './llm/LLMRouter.js';

export class RecursiveRunner {
  /**
   * Identifies if a task needs fractal decomposition.
   */
  isComplex(task: TaskNode): boolean {
    if (task.id.startsWith('micro_')) return false;
    return task.priority === 'critical' || task.label.toLowerCase().includes('build a full') || task.label.toLowerCase().includes('comprehensive');
  }

  /**
   * Spawns a sub-orchestrator for a complex task.
   */
  async decompose(
    parentTask: TaskNode,
    parentGoal: string,
    contextBriefing: string,
    depth = 0
  ): Promise<TaskDAG> {
    if (depth >= 2) {
      console.warn(`[RecursiveRunner] Max depth reached for task "${parentTask.id}". Executing as-is.`);
      return {
        missionId: `sub_${parentTask.id}`,
        goal: parentTask.label,
        goalType: 'analysis',
        status: 'pending',
        nodes: [{ ...parentTask, id: 'micro_1', dependencies: [] }],
        successCriteria: ['Completed sub-tasks.'],
        estimatedWaves: 1,
        requiresApproval: false,
        config: {},
      };
    }

    console.log(`[RecursiveRunner] 🧩 Decomposing Complex Task: ${parentTask.id}...`);

    const prompt = `
      You are the NexusOS Recursive Planner.
      PARENT GOAL: "${parentGoal}"
      TARGET COMPLEX TASK: "${parentTask.label}" (Agent: ${parentTask.agentType})
      
      CONTEXT FROM PRIOR TASKS:
      ${contextBriefing}

      REASONING TASK:
      1. Break this complex task into 3-5 atomic "Micro-Tasks".
      2. Each micro-task should be specialized and dependent on each other if needed.
      3. Create a valid TaskDAG for this sub-mission.

      REQUIRED JSON STRUCTURE:
      {
        "missionId": "sub_${parentTask.id}",
        "goal": "${parentTask.label}",
        "goalType": "analysis",
        "nodes": [
          {
            "id": "micro_1",
            "label": "First atomic step",
            "agentType": "researcher",
            "dependencies": [],
            "contextFields": [],
            "expectedOutput": { "format": "prose" }
          }
        ]
      }

      Respond ONLY with the JSON object.
    `;

    try {
      const res = await llmRouter.call({
        system: 'You are the NexusOS Recursive Planner.',
        user: prompt,
        model: MODEL_POWER,
        temperature: 0.1,
        maxTokens: 1000,
        jsonMode: true,
      });

      const subDag = JSON.parse(res.content) as TaskDAG;

      console.log(`[RecursiveRunner] Decomposed into ${subDag.nodes.length} micro-tasks.`);
      return subDag;
    } catch (err) {
      console.error('[RecursiveRunner] Decomposition failed, falling back to single execution:', err);
      throw err;
    }
  }

  /**
   * Merges results from a sub-DAG into a single artifact.
   */
  synthesizeResults(subArtifacts: MemoryEntry[]): string {
    return subArtifacts
      .map((art) => `[Micro-Task: ${art.taskId}] ${JSON.stringify(art.data).slice(0, 500)}`)
      .join('\n\n---\n\n');
  }
}

export const recursiveRunner = new RecursiveRunner();
