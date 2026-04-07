/**
 * Nexus OS — Tool Executor
 *
 * Executes tool calls requested by agents.
 * Validates inputs against the registry schema and handles the execution lifecycle.
 */

import { toolRegistry } from './toolRegistry.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import type { TypedArtifact } from '@nexus-os/types';

export interface ToolCall {
  toolName: string;
  arguments: any;
  missionId: string;
  taskId: string;
}

class ToolExecutor {
  /**
   * Executes a tool call and stores the result as an artifact.
   */
  async execute(call: ToolCall): Promise<any> {
    const { toolName, arguments: args, missionId, taskId } = call;

    console.log(`[ToolExecutor] 🛠️ Executing tool: ${toolName} for task: ${taskId}`);

    try {
      // 1. Fetch tool from registry
      const tool = toolRegistry.getTool(toolName);
      if (!tool) throw new Error(`Tool "${toolName}" not found in registry.`);

      // 2. Validate arguments (simplified validation)
      const required = tool.parameters.required || [];
      for (const field of required) {
        if (args[field] === undefined) {
          throw new Error(`Missing required argument "${field}" for tool "${toolName}"`);
        }
      }

      // 3. Emit "tool_started" event
      await eventBus.publish(missionId, {
        type: 'agent_working',
        taskId,
        taskLabel: taskId,
        message: `Executing tool: ${toolName}...`,
      } as any);

      // 4. Run the handler
      const result = await tool.handler(args);

      // 5. Store result as a generic Artifact in DB
      const artifact: TypedArtifact = {
        format: 'structured_json',
        agentType: 'coder', // Generic category for tool usage
        taskId,
        ...result,
        rawContent: JSON.stringify(result, null, 2),
      };

      await nexusStateStore.storeArtifact({
        missionId,
        taskId,
        type: 'tool_result',
        content: artifact,
      });

      console.log(`[ToolExecutor] ✅ Tool ${toolName} complete.`);
      return result;
    } catch (err: any) {
      console.error(`[ToolExecutor] ❌ Tool execution failed: ${toolName}`, err);
      throw err;
    }
  }
}

export const toolExecutor = new ToolExecutor();
