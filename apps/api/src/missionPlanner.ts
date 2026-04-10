import { randomUUID } from 'crypto';
/**
 * Nexus OS — Mission Planner v2.3
 *
 * FIX: Removed hardcoded Groq fetch calls.
 * Now routes through LLMRouter so it gets:
 *   - OpenRouter primary with model rotation
 *   - Groq as automatic fallback
 *   - Rate-limit monitoring & backoff
 *
 * Drop-in replacement for missionPlanner.ts — no other files change.
 */

import {
  TaskDAG,
  TaskNode,
  GoalType,
  AgentType,
} from '@nexus-os/types';
import { findBestAgentForType } from './agents/agentRegistry.js';
import { universalPlanner } from './core/universalPlanner.js';
import type { ArchitectureMode } from '@nexus-os/types';
import { llmRouter } from './llm/LLMRouter.js';       // ← was missing
import { MODEL_POWER } from './llm/LLMRouter.js';     // ← use the power tier for planning

export interface MapReduceTaskNode {
  id: string;
  label: string;
  agentType: import('@nexus-os/types').AgentType;
  chunks: string[];
  reduceStrategy: 'merge' | 'vote' | 'summarize';
}

// Modular Imports
import { SYSTEM_PROMPT, getDomainGuidance } from './planning/plannerPrompts.js';
import { extractJSON, detectCycles, deduplicateAndScore } from './planning/dagUtils.js';

// Removed: GROQ_API_URL, PLANNER_MODEL (now handled by LLMRouter)
const MAX_RETRIES  = 3;
const RETRY_DELAY  = 1000;
const VALID_AGENT_TYPES: AgentType[] = ['researcher', 'analyst', 'writer', 'coder', 'strategist', 'summarizer'];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function validateAndRepair(raw: unknown, goal: string): TaskDAG {
  const plan = raw as any;
  if (!plan || typeof plan !== 'object') throw new Error('Plan is not an object');
  if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) throw new Error('Plan must have at least one node');

  const ids = new Set<string>(plan.nodes.map((n: any) => n.id));

  for (const node of plan.nodes) {
    if (!node.id) node.id = `task_${randomUUID().slice(0, 8)}`;
    if (!VALID_AGENT_TYPES.includes(node.agentType)) node.agentType = 'researcher';
    if (!Array.isArray(node.dependencies)) node.dependencies = [];
    if (!Array.isArray(node.contextFields)) node.contextFields = node.dependencies.slice();
    if (!node.priority) node.priority = 'medium';
    if (typeof node.maxRetries !== 'number') node.maxRetries = 2;

    const specializedAgent = findBestAgentForType(node.agentType);
    node.agentId = specializedAgent.id;

    node.dependencies = node.dependencies.filter((dep: string) => ids.has(dep));
    node.contextFields = node.contextFields.filter((f: string) => node.dependencies.includes(f) && ids.has(f));
  }

  if (detectCycles(plan.nodes)) throw new Error('DAG cycle detected');

  return {
    missionId: crypto.randomUUID(),
    goal,
    goalType: (plan.goalType as GoalType) || 'general',
    successCriteria: Array.isArray(plan.successCriteria) ? plan.successCriteria : [],
    nodes: deduplicateAndScore(plan.nodes, goal),
    estimatedWaves: 0,
  };
}

export async function planMission(goal: string, archMode: ArchitectureMode = 'legacy'): Promise<TaskDAG> {
  if (archMode === 'os') return await universalPlanner.plan(goal, 'os');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 1: Classify the goal type (fast call, low tokens)
      let goalType = 'general';
      try {
        const dtResult = await llmRouter.call({
          system: 'Classify this goal into exactly one word: lead_gen, strategy, research, content, code, analysis, general. Reply with only the word.',
          user: goal,
          model: MODEL_POWER,
          maxTokens: 10,
          temperature: 0.0,
        });
        goalType = dtResult.content.trim().toLowerCase().split(/\s+/)[0] || 'general';
      } catch {
        // classification failure is non-fatal — proceed with 'general'
      }

      // Step 2: Generate the full DAG plan
      const result = await llmRouter.call({
        system: SYSTEM_PROMPT,
        user: `GOAL: "${goal}"\nTYPE: ${goalType}\nGUIDANCE: ${getDomainGuidance(goalType)}`,
        model: MODEL_POWER,
        maxTokens: 1800,
        temperature: 0.15,
      });

      const parsed = extractJSON(result.content);
      return validateAndRepair(parsed, goal);

    } catch (err) {
      console.warn(`[Planner] Attempt ${attempt} failed: ${err}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY * attempt);
    }
  }

  throw new Error('Mission planning failed after retries');
}
