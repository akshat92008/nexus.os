import { randomUUID } from 'crypto';
/**
 * Nexus OS — Mission Planner v2.2
 * 
 * Modular high-precision task decomposition engine.
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

const GROQ_API_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const PLANNER_MODEL = 'llama-3.3-70b-versatile';
const MAX_RETRIES   = 3;
const RETRY_DELAY   = 1000;
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
    estimatedWaves: 0, // Computed at runtime by worker
  };
}

export async function planMission(goal: string, archMode: ArchitectureMode = 'legacy'): Promise<TaskDAG> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  if (archMode === 'os') return await universalPlanner.plan(goal, 'os');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const dtResponse = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: PLANNER_MODEL,
          temperature: 0.0,
          max_tokens: 30,
          messages: [
            { role: 'system', content: 'Classify this goal into: lead_gen, strategy, research, content, code, analysis, general.' },
            { role: 'user', content: goal },
          ],
        }),
      });

      let goalType = 'general';
      if (dtResponse.ok) {
        const dtData = await dtResponse.json() as any;
        goalType = dtData?.choices?.[0]?.message?.content?.trim().toLowerCase() || 'general';
      }

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: PLANNER_MODEL,
          temperature: 0.15,
          max_tokens: 1800,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `GOAL: "${goal}"\nTYPE: ${goalType}\nGUIDANCE: ${getDomainGuidance(goalType)}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json() as any;
      const parsed = extractJSON(data?.choices?.[0]?.message?.content || '');
      return validateAndRepair(parsed, goal);

    } catch (err) {
      console.warn(`[Planner] Attempt ${attempt} failed: ${err}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY * attempt);
    }
  }

  throw new Error('Mission planning failed after retries');
}
