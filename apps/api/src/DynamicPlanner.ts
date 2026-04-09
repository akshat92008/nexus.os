/**
 * Nexus OS — Dynamic Planner (Autonomous Reasoning Engine)
 *
 * This module enables "Dynamic Intelligence" by allowing the orchestrator
 * to re-evaluate the TaskDAG after each wave.
 */

import type { TaskDAG, TaskNode, MemoryEntry } from '@nexus-os/types';

interface SupervisorDecision {
  status: 'proceed' | 'drill_down' | 'pivot';
  reasoning: string;
  newTasks?: TaskNode[];
}

import { 
  MODEL_POWER 
} from './agents/agentConfig.js';
import { llmRouter } from './llm/LLMRouter.js';

export class DynamicPlanner {
  /**
   * Reviews the current mission state and decides if we need to expand the DAG.
   */
  async supervise(
    dag: TaskDAG,
    artifacts: MemoryEntry[],
    waveIndex: number
  ): Promise<SupervisorDecision> {
    console.log(`[DynamicPlanner] 🧠 Supervising Wave ${waveIndex + 1}...`);

    if (artifacts.length === 0) return { status: 'proceed', reasoning: 'No data yet.' };

    const missionContext = artifacts
      .map((art) => `[Task: ${art.taskId}] Result: ${JSON.stringify(art.data).slice(0, 500)}...`)
      .join('\n\n');

    const prompt = `
      You are the NexusOS Mission Supervisor.
      GOAL: "${dag.goal}"
      CURRENT WAVE: ${waveIndex + 1}
      
      EVIDENCE GATHERED SO FAR:
      ${missionContext}

      REASONING TASK:
      1. Is the data gathered so far sufficient to achieve the MISSION GOAL?
      2. Are there any critical gaps or contradictions in the findings?
      3. Should we "proceed" to the next planned wave, or "drill_down" by injecting new targeted tasks?

      If "drill_down", provide a list of NEW tasks to inject.
      Respond ONLY with a JSON object:
      {
        "status": "proceed" | "drill_down" | "pivot",
        "reasoning": "your explanation",
        "newTasks": [] // only if status is drill_down
      }
    `;

    try {
      const res = await llmRouter.call({
        system: 'You are the NexusOS Mission Supervisor.',
        user: prompt,
        model: MODEL_POWER,
        temperature: 0.1,
        jsonMode: true,
      });

      const decision = JSON.parse(res.content) as SupervisorDecision;

      console.log(`[DynamicPlanner] Decision: ${decision.status.toUpperCase()} - ${decision.reasoning}`);
      return decision;
    } catch (err) {
      console.error('[DynamicPlanner] Supervision failed, proceeding as planned:', err);
      return { status: 'proceed', reasoning: 'Supervision error fallback.' };
    }
  }

  injectTasks(dag: TaskDAG, newTasks: TaskNode[]): void {
    if (!newTasks.length) return;
    console.log(`[DynamicPlanner] 💉 Injecting ${newTasks.length} new tasks into the DAG.`);
    newTasks.forEach(task => {
      if (!dag.nodes.find(n => n.id === task.id)) {
        dag.nodes.push(task);
      }
    });
  }
}

export const dynamicPlanner = new DynamicPlanner();
