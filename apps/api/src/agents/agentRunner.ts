/**
 * Nexus OS — Agent Runner v2 (Modular)
 *
 * Rewritten as part of the G2 "Agentic Accessibility" refactor.
 * This file now focuses exclusively on the execution flow and AI infrastructure.
 */

import type { Response } from 'express';
import { semanticBridge } from './services/SemanticBridge.js';
import { 
  TaskNode, 
  AgentContext, 
  TypedArtifact, 
  GoalType 
} from '@nexus-os/types';

import { 
  GROQ_API_URL, 
  GROQ_FAST_MODEL, 
  GROQ_POWER_MODEL, 
  TOKEN_BUDGET 
} from './agentConfig.js';

import { buildAgentPrompt } from './promptBuilder.js';
import { parseTypedArtifact } from './outputParser.js';

// ── AI INFRASTRUCTURE ───────────────────────────────────────────────────────

const MAX_TASK_RUNTIME_MS = 120_000; 
const HARD_TOKEN_LIMIT    = 4000;    
const MAX_AGENT_STEPS     = 5;
const MAX_TOTAL_TOKENS    = 8000;
const MAX_AGENT_RUNTIME_MS = 120_000;

export interface RunAgentOptions {
  task: TaskNode;
  goal: string;
  goalType: GoalType;
  context: AgentContext;
  sseRes?: Response; 
  isAborted: () => boolean;
}

export interface AgentRunResult {
  artifact: TypedArtifact;
  tokensUsed: number;
  rawContent: string;
}

async function runGroq(opts: {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      max_tokens: Math.min(opts.maxTokens, HARD_TOKEN_LIMIT),
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
    signal: opts.signal || AbortSignal.timeout(MAX_TASK_RUNTIME_MS),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    throw new Error(`429 Too Many Requests${retryAfter ? ` retry-after: ${retryAfter}` : ''}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? '[No output]';

  return {
    content,
    tokens: (data?.usage?.completion_tokens ?? 0) + (data?.usage?.prompt_tokens ?? 0),
  };
}

// ── CORE EXECUTION ──────────────────────────────────────────────────────────

/**
 * Core Agent Runner
 * Executes a single task for a specific agent type.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const { task, goal, goalType, context, sseRes, isAborted } = opts;
  const startMs = Date.now();
  const controller = new AbortController();
  const runtimeTimer = setTimeout(() => controller.abort(new Error(`[Limits] Max runtime ${MAX_AGENT_RUNTIME_MS}ms exceeded`)), MAX_AGENT_RUNTIME_MS);
  let steps = 0;
  let totalTokens = 0;

  console.log(`[AgentRunner] 🤖 ${task.agentType.toUpperCase()} starting task: ${task.id}`);

  // SSE status update
  if (sseRes) {
    sseRes.write(`data: ${JSON.stringify({
      type: 'agent_status',
      agentId: task.id,
      status: 'working',
      agentType: task.agentType,
    })}\n\n`);
  }

  async function callGroq(args: Parameters<typeof runGroq>[0]) {
    if (steps >= MAX_AGENT_STEPS) throw new Error(`[Limits] Max steps exceeded (${MAX_AGENT_STEPS})`);
    steps += 1;
    const res = await runGroq({ ...args, signal: controller.signal });
    totalTokens += res.tokens;
    if (totalTokens > MAX_TOTAL_TOKENS) throw new Error(`[Limits] Max tokens exceeded (${totalTokens} > ${MAX_TOTAL_TOKENS})`);
    return res;
  }

  // 1. Semantic Context Synthesis
  const briefing = context.entries.length > 0
    ? await semanticBridge.synthesizeBriefing(goal, context.entries, task)
    : 'No prior context available. Start from scratch.';

  const synthesizedContext: AgentContext = {
    ...context,
    promptBlock: `### MISSION BRIEFING (Synthesized Truths)\n${briefing}\n\n`
  };

  const { system, user } = buildAgentPrompt(task, goal, goalType, synthesizedContext);
  const maxTokens = TOKEN_BUDGET[task.agentType] ?? 600;
  const expectsJson = task.expectedOutput.format !== 'prose';

  if (isAborted()) throw new Error('[Canceled] Mission aborted');

  // 2. Council of Three (Logical Cross-Examination)
  if (task.priority === 'critical' && task.agentType !== 'chief_analyst') {
    console.log(`[AgentRunner] ⚖️ Council of Three activated for Critical Task: ${task.id}`);
    
    const [specialist1, specialist2] = await Promise.all([
      callGroq({ system, user, model: GROQ_FAST_MODEL, maxTokens, temperature: 0.4, jsonMode: expectsJson }),
      callGroq({ system, user, model: GROQ_FAST_MODEL, maxTokens, temperature: 0.7, jsonMode: expectsJson }),
    ]);

    const judgePrompt = `
      You are the NexusOS Reasoning Judge.
      MISSION GOAL: "${goal}"
      TARGET TASK: "${task.label}"

      AGENT OUTPUT 1:
      ${specialist1.content}

      AGENT OUTPUT 2:
      ${specialist2.content}

      REASONING TASK:
      1. Identify contradictions or factual errors.
      2. Resolve logical inconsistencies.
      3. Synthesize a single, "Verified Artifact". 

      Respond ONLY with final verified content.
    `;

    const { content: verifiedContent, tokens: judgeTokens } = await callGroq({
      system: expectsJson
        ? 'You are a master logic judge. Return ONLY valid JSON.'
        : 'You are a master logic judge.',
      user: judgePrompt,
      model: GROQ_POWER_MODEL,
      maxTokens,
      temperature: 0.1,
      jsonMode: expectsJson,
    });

    const artifact = parseTypedArtifact(verifiedContent, task);
    clearTimeout(runtimeTimer);
    return { artifact, tokensUsed: specialist1.tokens + specialist2.tokens + judgeTokens, rawContent: verifiedContent };
  }

  // Standard execution
  const isIntelligenceTask = ['researcher', 'analyst', 'chief_analyst'].includes(task.agentType);
  const model = (isIntelligenceTask || task.priority === 'critical') ? GROQ_POWER_MODEL : GROQ_FAST_MODEL;

  const { content, tokens } = await callGroq({
    system,
    user,
    model,
    maxTokens,
    temperature: task.agentType === 'analyst' ? 0.3 : 0.6,
    jsonMode: expectsJson,
  });

  const artifact = parseTypedArtifact(content, task);
  console.log(`[AgentRunner] ✅ ${task.agentType.toUpperCase()} finished task: ${task.id} (${Date.now() - startMs}ms)`);

  clearTimeout(runtimeTimer);
  return { artifact, tokensUsed: tokens, rawContent: content };
}
