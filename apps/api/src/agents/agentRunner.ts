/**
 * Nexus OS — Agent Runner v2 (Modular)
 *
 * Rewritten as part of the G2 "Agentic Accessibility" refactor.
 * This file now focuses exclusively on the execution flow and AI infrastructure.
 */

import type { Response } from 'express';
import { Sandbox } from '@e2b/code-interpreter';
import { semanticBridge } from './services/SemanticBridge.js';
import { 
  TaskNode, 
  AgentContext, 
  TypedArtifact, 
  GoalType 
} from '@nexus-os/types';

import { 
  MODEL_FAST, 
  MODEL_POWER, 
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

// ── E2B Code Execution ────────────────────────────────────────────────────

async function executeCodeWithE2B(code: string): Promise<{ stdout: string; stderr: string }> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.warn('[AgentRunner] E2B_API_KEY not set, skipping code execution');
    return { stdout: 'E2B not configured', stderr: '' };
  }

  try {
    const sandbox = await Sandbox.create({ apiKey });
    console.log('[AgentRunner] 🔌 E2B Sandbox initialized');
    
    const execution = await sandbox.runCode(code, 'python');
    console.log('[AgentRunner] ✅ Code executed successfully');
    
    await sandbox.kill();
    
    return {
      stdout: execution.logs.stdout.join('\n'),
      stderr: execution.logs.stderr.join('\n'),
    };
  } catch (err: any) {
    console.error('[AgentRunner] ❌ E2B code execution failed:', err.message);
    return { stdout: '', stderr: `E2B execution error: ${err.message}` };
  }
}

import { llmRouter } from '../llm/LLMRouter.js';

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

  async function callLLM(args: {
    system: string;
    user: string;
    model: string;
    maxTokens: number;
    temperature: number;
    jsonMode: boolean;
    enableStreaming?: boolean;
    onStreamChunk?: (chunk: string) => void;
  }) {
    if (steps >= MAX_AGENT_STEPS) throw new Error(`[Limits] Max steps exceeded (${MAX_AGENT_STEPS})`);
    steps += 1;
    
    const res = await llmRouter.call({
      ...args,
      signal: controller.signal,
    });

    totalTokens += res.tokens;
    
    if (totalTokens > MAX_TOTAL_TOKENS) throw new Error(`[Limits] Max tokens exceeded (${totalTokens} > ${MAX_TOTAL_TOKENS})`);
    
    return res;
  }

  const callGroq = callLLM; // Maintain compatibility for the rest of the file


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
      callGroq({ system, user, model: MODEL_FAST, maxTokens, temperature: 0.4, jsonMode: expectsJson }),
      callGroq({ system, user, model: MODEL_FAST, maxTokens, temperature: 0.7, jsonMode: expectsJson }),
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

    // Enable streaming for the judge in Council of Three
    const { content: verifiedContent, tokens: judgeTokens } = await callGroq({
      system: expectsJson
        ? 'You are a master logic judge. Return ONLY valid JSON.'
        : 'You are a master logic judge.',
      user: judgePrompt,
      model: MODEL_POWER,
      maxTokens,
      temperature: 0.1,
      jsonMode: expectsJson,
      enableStreaming: !!sseRes,
      onStreamChunk: sseRes ? (chunk: string) => {
        if (chunk.length > 0) {
          try {
            sseRes.write(`data: ${JSON.stringify({
              type: 'agent_output_chunk',
              taskId: task.id,
              chunk: chunk,
            })}\n\n`);
          } catch {
            // Socket may be closed
          }
        }
      } : undefined,
    });

    const artifact = parseTypedArtifact(verifiedContent, task);
    
    // For coder agents, execute generated code via E2B
    if (task.agentType === 'coder' && (artifact as any).code) {
      const { stdout, stderr } = await executeCodeWithE2B((artifact as any).code);
      (artifact as any).executionOutput = { stdout, stderr };
    }
    
    clearTimeout(runtimeTimer);
    return { artifact, tokensUsed: specialist1.tokens + specialist2.tokens + judgeTokens, rawContent: verifiedContent };
  }

  // Standard execution
  const isIntelligenceTask = ['researcher', 'analyst', 'chief_analyst'].includes(task.agentType);
  const model = (isIntelligenceTask || task.priority === 'critical') ? MODEL_POWER : MODEL_FAST;

  // Enable streaming for high-budget agents to stream long outputs in real-time
  const shouldStream = (maxTokens >= 2000) && !!sseRes;

  const { content, tokens } = await callGroq({
    system,
    user,
    model,
    maxTokens,
    temperature: task.agentType === 'analyst' ? 0.3 : 0.6,
    jsonMode: expectsJson,
    enableStreaming: shouldStream,
    onStreamChunk: shouldStream ? (chunk: string) => {
      // Stream individual chunks via SSE for real-time UI updates
      if (sseRes && chunk.length > 0) {
        try {
          sseRes.write(`data: ${JSON.stringify({
            type: 'agent_output_chunk',
            taskId: task.id,
            chunk: chunk,
          })}\n\n`);
        } catch {
          // Socket may be closed, fail silently
        }
      }
    } : undefined,
  });

  const artifact = parseTypedArtifact(content, task);
  
  // For coder agents, attempt code execution via E2B and append results to artifact
  if (task.agentType === 'coder' && (artifact as any).code) {
    const { stdout, stderr } = await executeCodeWithE2B((artifact as any).code);
    (artifact as any).executionOutput = { stdout, stderr };
    if (stderr) {
      console.warn(`[AgentRunner] Code execution returned stderr: ${stderr}`);
    }
  }
  
  console.log(`[AgentRunner] ✅ ${task.agentType.toUpperCase()} finished task: ${task.id} (${Date.now() - startMs}ms)`);

  clearTimeout(runtimeTimer);
  return { artifact, tokensUsed: tokens, rawContent: content };
}
