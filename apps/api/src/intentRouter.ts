/**
 * NexusOS — Intent Router (LLM-Powered Classification)
 *
 * Replaces fragile regex/persona-based routing with an LLM classifier.
 * Agents: BUSINESS_AGENT, DEV_AGENT, SYS_AGENT, LIFE_AGENT.
 */

import { universalPlanner } from './core/universalPlanner.js';
import { logger } from './logger.js';
import { repairJson } from './core/jsonRepair.js';
import type { TaskNode, TaskDAG } from '@nexus-os/types';

export type AgentType = 'BUSINESS_AGENT' | 'DEV_AGENT' | 'SYS_AGENT' | 'LIFE_AGENT';

export interface RoutedIntent {
  agent: AgentType;
  confidence: number;
  intent: any;
  tasks: TaskNode[];
  formatter: (synthesis: any) => any;
  dag?: TaskDAG;
}

/**
 * LLM-based intent classification.
 * Uses a cheap/fast model for classification (~$0.00003/call).
 */
async function classifyIntent(userInput: string): Promise<{ agent: AgentType; confidence: number }> {
  try {
    const { llmRouter } = await import('./llm/LLMRouter.js');
    const response = await llmRouter.complete({
      model: 'fast',
      system: `You are an intent classifier for Nexus OS, an AI employee.
Classify the user request into exactly one of these agents:
- BUSINESS_AGENT: email, CRM, invoicing, client, sales, revenue, meeting, proposal, lead, follow-up, marketing, contract
- DEV_AGENT: code, git, debug, build, npm, test, scaffold, deploy, API, PR, lint, refactor, review, terminal, shell
- SYS_AGENT: files, apps, desktop, system settings, GUI automation, screen, wifi, bluetooth, camera, screenshot
- LIFE_AGENT: calendar, reminders, notes, personal tasks, schedule, health, fitness, family, travel

Respond with ONLY a JSON object: {"agent": "BUSINESS_AGENT|DEV_AGENT|SYS_AGENT|LIFE_AGENT", "confidence": 0.0-1.0}
No markdown. No explanation.`,
      messages: [{ role: 'user', content: userInput }],
      temperature: 0.1
    });

    const cleaned = response.content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as { agent: string; confidence: number };
    const agent = (['BUSINESS_AGENT', 'DEV_AGENT', 'SYS_AGENT', 'LIFE_AGENT'].includes(parsed.agent)
      ? parsed.agent
      : 'LIFE_AGENT') as AgentType;

    return { agent, confidence: parsed.confidence ?? 0.5 };
  } catch (err) {
    logger.warn({ err }, '[IntentRouter] LLM classification failed, falling back to LIFE_AGENT');
    return { agent: 'LIFE_AGENT', confidence: 0.0 };
  }
}

/**
 * Main routing entrypoint.
 */
export async function routeIntent(input: string, _legacyMode?: string, archMode?: string): Promise<RoutedIntent> {
  logger.info(`[IntentRouter] 🗺️ Classifying: "${input.slice(0, 80)}..."`);

  // 1. OS Mode: Use the universal planner (Primitive-first)
  if (archMode === 'os') {
    const dag = await universalPlanner.plan(input);
    return {
      agent: 'DEV_AGENT',
      confidence: 1.0,
      intent: { type: 'universal', goal: input },
      tasks: dag.nodes,
      formatter: (s) => s,
      dag
    };
  }

  // 2. LLM-based classification
  const classification = await classifyIntent(input);
  if (classification.confidence < 0.7) {
    logger.info(`[IntentRouter] ⚠️ Low confidence (${classification.confidence}) — defaulting to LIFE_AGENT`);
  }

  logger.info(`[IntentRouter] 🎯 Routed to ${classification.agent} (confidence: ${classification.confidence})`);

  const dag = await universalPlanner.plan(input);
  return {
    agent: classification.agent,
    confidence: classification.confidence,
    intent: { type: classification.agent, goal: input },
    tasks: dag.nodes,
    formatter: (s) => s,
    dag
  };
}
