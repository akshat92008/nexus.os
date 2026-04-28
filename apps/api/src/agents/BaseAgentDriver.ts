/**
 * NexusOS — Base Agent Driver
 * 
 * Standardized interface for building "Apps" (Agents) for Nexus OS.
 * Developers should extend this class to create new specialized neural units.
 */

import type { 
  AgentType, 
  TaskNode, 
  AgentContext, 
  AgentRunResult,
  TypedArtifact
} from '@nexus-os/types';

export abstract class BaseAgentDriver {
  /**
   * Unique identifier for the agent (e.g., 'nexus-researcher-pro')
   */
  abstract readonly id: string;

  /**
   * Human-readable name
   */
  abstract readonly name: string;

  /**
   * The core agent type this driver implements
   */
  abstract readonly type: AgentType;

  /**
   * Execute the agent's primary logic.
   * This is where the developer implements the LLM call or tool execution.
   */
  abstract run(opts: {
    task: TaskNode;
    goal: string;
    context: AgentContext;
    signal?: AbortSignal;
  }): Promise<AgentRunResult>;

  /**
   * Optional: Validate the task before execution.
   * Return a string error message if invalid, or null if valid.
   */
  validateTask(task: TaskNode): string | null {
    if (task.agentType !== this.type) {
      return `Agent type mismatch: expected ${this.type}, got ${task.agentType}`;
    }
    return null;
  }

  /**
   * Helper: Wrap raw content into a basic artifact
   */
  protected wrapProse(taskId: string, content: string): TypedArtifact {
    return {
      format: 'prose',
      agentType: this.type as any,
      taskId,
      body: content,
      wordCount: content.split(/\s+/).length,
      rawContent: content,
    };
  }
}
