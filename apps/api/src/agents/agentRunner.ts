/**
 * Nexus OS — Agent Runner v2 (Modular)
 *
 * Rewritten as part of the G2 "Agentic Accessibility" refactor.
 * This file now focuses exclusively on the execution flow and AI infrastructure.
 */

import type { Response } from 'express';
import { semanticBridge } from './services/SemanticBridge.js';
import { toolExecutor } from '../tools/toolExecutor.js';
import { 
  TaskNode, 
  AgentContext, 
  TypedArtifact, 
  GoalType 
} from '@nexus-os/types';
import { buildAgentPrompt } from './promptBuilder.js';
import { parseTypedArtifact } from './outputParser.js';
import { nexusStateStore as missionStore } from '../storage/nexusStateStore.js';

import { 
  MODEL_FAST, 
  MODEL_POWER, 
  TOKEN_BUDGET 
} from './agentConfig.js';

import { missionReplayer, missionRecorder, isRecordMode, isReplayMode } from '../missionReplay.js';

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
  missionId: string;
  userId: string;
  workspaceId?: string;
}

export interface AgentRunResult {
  artifact: TypedArtifact;
  tokensUsed: number;
  rawContent: string;
}

import { llmRouter } from '../llm/LLMRouter.js';
import { logger } from '../logger.js';

// ── CORE EXECUTION ──────────────────────────────────────────────────────────

/**
 * Core Agent Runner
 * Executes a single task for a specific agent type.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentRunResult> {
  const { task, goal, goalType, context, sseRes, isAborted } = opts;
  const startMs = Date.now();

  // MISSION REPLAY: Check if we have a recorded response for this task
  if (isReplayMode) {
    const replayResponse = missionReplayer.getReplayResponse(task.id, task.agentType, {
      prompt: goal,
      context: context.entries.reduce((acc, entry) => {
        acc[entry.taskId] = entry.artifact;
        return acc;
      }, {} as Record<string, TypedArtifact>),
      taskNode: task
    });

    if (replayResponse) {
      logger.info({ taskId: task.id, agentType: task.agentType }, '🎬 REPLAYING task');
      return {
        artifact: replayResponse,
        tokensUsed: 0, // No tokens used in replay
        rawContent: JSON.stringify(replayResponse)
      };
    }
  }

  const controller = new AbortController();
  const runtimeTimer = setTimeout(() => controller.abort(new Error(`[Limits] Max runtime ${MAX_AGENT_RUNTIME_MS}ms exceeded`)), MAX_AGENT_RUNTIME_MS);
  let steps = 0;
  let totalTokens = 0;

  logger.info({ taskId: task.id, agentType: task.agentType }, '🤖 Agent starting task');

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

  let briefing: string;
  // 1. Semantic Context Synthesis
  if (context.entries.length > 0) {
    await missionStore.updateTaskCheckpoint(task.id, { step: 'Briefing Context Synthesis' });
    briefing = await semanticBridge.synthesizeBriefing(goal, context.entries, task);
  } else {
    briefing = 'No prior context available. Start from scratch.';
  }

  const synthesizedContext: AgentContext = {
    ...context,
    promptBlock: `### MISSION BRIEFING (Synthesized Truths)\n${briefing}\n\n`
  };

  const { system, user } = buildAgentPrompt(task, goal, goalType, synthesizedContext);
  const maxTokens = TOKEN_BUDGET[task.agentType] ?? 600;
  const expectsJson = task.expectedOutput.format !== 'prose';

  if (isAborted()) throw new Error('[Canceled] Mission aborted');

  // -- P0: Council of Three (High-precision reasoning for critical tasks) --
  if (task.priority === 'critical' || task.agentType === 'chief_analyst') {
    logger.info({ taskId: task.id }, 'Council of Three activated for Critical Task');
    
    await missionStore.updateTaskCheckpoint(task.id, { step: 'Council of Three: Specialist Consultation' });
    const [specialist1, specialist2] = await Promise.all([
      callGroq({ system, user, model: MODEL_FAST, maxTokens, temperature: 0.4, jsonMode: expectsJson }),
      callGroq({ system, user, model: MODEL_FAST, maxTokens, temperature: 0.7, jsonMode: expectsJson }),
    ]);

    await missionStore.updateTaskCheckpoint(task.id, { step: 'Council of Three: Master Brain Synthesis' });
    const judgePrompt = `
      You are the NexusOS Reasoning Judge (Master Brain Tie-breaker).
      MISSION GOAL: "${goal}"
      TARGET TASK: "${task.label}"

      AGENT OUTPUT 1 (Standard Temperature):
      ${specialist1.content}

      AGENT OUTPUT 2 (High Temperature/Exploratory):
      ${specialist2.content}

      REASONING TASK:
      1. Identify contradictions or factual errors.
      2. Resolve logical inconsistencies.
      3. Synthesize a single, "Verified Artifact". 
      
      MASTER OVERRIDE: 
      If AGENT 1 and AGENT 2 disagree on fundamental facts, you must act as the ultimate arbiter. 
      Prioritize the most logically sound and goal-aligned evidence.

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
      const result = await toolExecutor.execute({
        toolName: 'code_execution',
        arguments: {
          language: 'python',
          code: (artifact as any).code,
        },
        missionId: opts.missionId,
        taskId: task.id,
        userId: opts.userId,
        workspaceId: opts.workspaceId,
      });
      (artifact as any).executionOutput = result;
    }

    // MISSION RECORDING: Record the interaction for future replay
    if (isRecordMode) {
      missionRecorder.recordInteraction({
        taskId: task.id,
        agentType: task.agentType,
        input: {
          prompt: goal,
          context: synthesizedContext.entries.reduce((acc, entry) => {
            acc[entry.taskId] = entry.artifact;
            return acc;
          }, {} as Record<string, TypedArtifact>),
          taskNode: task
        },
        output: artifact,
        metadata: {
          tokensUsed: specialist1.tokens + specialist2.tokens + judgeTokens,
          duration: Date.now() - startMs,
          missionId: opts.missionId,
          userId: opts.userId,
          councilOfThree: true
        }
      });
    }
    
    clearTimeout(runtimeTimer);
    return { artifact, tokensUsed: specialist1.tokens + specialist2.tokens + judgeTokens, rawContent: verifiedContent };
  }

  // Standard execution
  const isIntelligenceTask = ['researcher', 'analyst', 'chief_analyst'].includes(task.agentType);
  const model = (isIntelligenceTask || task.priority === 'critical') ? MODEL_POWER : MODEL_FAST;

  // Enable streaming for high-budget agents to stream long outputs in real-time
  const shouldStream = (maxTokens >= 2000) && !!sseRes;

  try {
    await missionStore.updateTaskCheckpoint(task.id, { step: `Execution (${task.agentType})` });
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
    
    // For coder agents, attempt code execution via toolExecutor and append results to artifact
    if (task.agentType === 'coder' && (artifact as any).code) {
      const result = await toolExecutor.execute({
        toolName: 'code_execution',
        arguments: {
          language: 'python',
          code: (artifact as any).code,
        },
        missionId: opts.missionId,
        taskId: task.id,
        userId: opts.userId,
        workspaceId: opts.workspaceId,
      });
      (artifact as any).executionOutput = result;
      if ((result as any).stderr) {
        logger.warn({ taskId: task.id, stderr: (result as any).stderr }, 'Code execution returned stderr');
      }
    }
    
    // MISSION RECORDING: Record the interaction for future replay
    if (isRecordMode) {
      missionRecorder.recordInteraction({
        taskId: task.id,
        agentType: task.agentType,
        input: {
          prompt: goal,
          context: context.entries.reduce((acc, entry) => {
            acc[entry.taskId] = entry.artifact;
            return acc;
          }, {} as Record<string, TypedArtifact>),
          taskNode: task
        },
        output: artifact,
        metadata: {
          tokensUsed: tokens,
          duration: Date.now() - startMs,
          missionId: opts.missionId,
          userId: opts.userId
        }
      });
    }

    logger.info({ taskId: task.id, duration: Date.now() - startMs }, 'Agent finished task');
    clearTimeout(runtimeTimer);
    return { artifact, tokensUsed: tokens, rawContent: content };
  } catch (error) {
    clearTimeout(runtimeTimer);
    logger.error({ taskId: task.id, err: (error as any).message }, 'Agent execution failed');
    throw error;
  }
}
