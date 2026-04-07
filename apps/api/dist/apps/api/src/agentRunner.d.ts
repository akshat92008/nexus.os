/**
 * Nexus OS — Agent Runner v2
 *
 * Replaces the runAgent() function in agentManager.ts.
 * Key changes:
 *
 * 1. buildAgentPrompt() — 4-part prompt: role+goal, context (selective),
 *    output schema enforcement, anti-hallucination constraints.
 *
 * 2. parseTypedArtifact() — attempts to parse LLM output as a TypedArtifact.
 *    Falls back gracefully: if JSON parse fails, wraps prose in a ContentArtifact.
 *    Never returns raw undefined or throws on bad output.
 *
 * 3. Token budget management — different limits per agent type.
 *    Researcher gets more tokens; summarizer gets fewer.
 */
import type { Response } from 'express';
import type { TaskNode, AgentContext, TypedArtifact, GoalType } from '../../../packages/types/index.js';
export declare function buildAgentPrompt(task: TaskNode, goal: string, goalType: GoalType, context: AgentContext): {
    system: string;
    user: string;
};
/**
 * Attempts to parse LLM response into a TypedArtifact.
 * Never throws — always returns a valid artifact.
 *
 * Priority:
 * 1. Try JSON.parse → wrap in the right artifact type
 * 2. Try extracting JSON block from mixed text
 * 3. Wrap raw text in ContentArtifact (graceful degradation)
 */
export declare function parseTypedArtifact(rawText: string, task: TaskNode): TypedArtifact;
export interface RunAgentOptions {
    task: TaskNode;
    goal: string;
    goalType: GoalType;
    context: AgentContext;
    sseRes: Response;
    isAborted: () => boolean;
}
export interface AgentRunResult {
    artifact: TypedArtifact;
    tokensUsed: number;
    rawContent: string;
}
export declare function runAgent(opts: RunAgentOptions): Promise<AgentRunResult>;
//# sourceMappingURL=agentRunner.d.ts.map