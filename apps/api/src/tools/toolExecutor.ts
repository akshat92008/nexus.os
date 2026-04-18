/**
 * Nexus OS — Tool Executor
 *
 * Executes tool calls requested by agents.
 * Validates inputs against the registry schema and handles the execution lifecycle.
 */

import { toolRegistry } from './toolRegistry.js';
import { eventBus } from '../events/eventBus.js';
import { nexusStateStore } from '../storage/nexusStateStore.js';
import { sagaManager } from '../services/SagaManager.js';
import type { TypedArtifact } from '@nexus-os/types';

export interface ToolCall {
  toolName: string;
  arguments: any;
  missionId: string;
  taskId: string;
  userId: string;
  workspaceId?: string;
}

class ToolExecutor {
  /**
   * Executes a tool call and stores the result as an artifact.
   */
  async execute(call: ToolCall): Promise<any> {
    let { toolName, arguments: args, missionId, taskId, userId, workspaceId } = call;

    console.log(`[ToolExecutor] 🛠️ Executing tool: ${toolName} for task: ${taskId} by user: ${userId}`);

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

      if (tool.schema) { 
        const result = tool.schema.safeParse(args); 
        if (!result.success) { 
          throw new Error(`[ToolExecutor] Invalid arguments for "${toolName}": ${result.error.message}`); 
        } 
        args = result.data; 
      } 

      // 3. Emit "tool_started" event
      await eventBus.publish(missionId, {
        type: 'agent_working',
        taskId,
        taskLabel: taskId,
        message: `Executing tool: ${toolName}...`,
      } as any);

      // 4. Determine Undo Parameters (Saga Pattern)
      const undoParams = this.calculateUndoParams(toolName, args);

      // 5. Log Action to Saga Store
      await sagaManager.logAction(missionId, toolName, args, undoParams);

      // 6. Run the handler
      const result = await tool.handler(args, { userId, workspaceId });

      const MAX_ARTIFACT_BYTES = 500_000; 
      if (JSON.stringify(result).length > MAX_ARTIFACT_BYTES) { 
        throw new Error(`[ToolExecutor] Tool "${toolName}" returned an oversized artifact. Truncate output.`); 
      } 

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
  /**
   * Reverses a previously logged action.
   */
  async undoAction(action: { tool_id: string, undo_params: any, goal_id: string }): Promise<any> {
    console.log(`[ToolExecutor] ⏪ Undoing: ${action.tool_id} ...`);
    
    if (!action.undo_params) {
      throw new Error(`Action ${action.tool_id} has no undo parameters.`);
    }

    // Map undo_params to a secondary tool call
    let undoTool: string;
    let undoArgs: any;

    switch (action.tool_id) {
      case 'create_folder':
        undoTool = 'shell_execute'; // We use a shell command to remove it
        undoArgs = { command: `rm -rf ${action.undo_params.path}` };
        break;
      case 'write_file':
        undoTool = 'write_file';
        undoArgs = { path: action.undo_params.path, content: action.undo_params.original_content };
        break;
      default:
        throw new Error(`Undo logic not implemented for tool: ${action.tool_id}`);
    }

    // Execute the undo tool without logging it to Saga (prevent loops)
    const tool = toolRegistry.getTool(undoTool);
    if (!tool) throw new Error(`Undo tool ${undoTool} not found.`);
    
    return await tool.handler(undoArgs, { userId: 'system' });
  }

  /**
   * Simple logic to determine how to reverse an action.
   */
  private calculateUndoParams(tool: string, params: any): any {
    switch (tool) {
      case 'create_folder': return { path: params.path, action: 'delete' };
      case 'write_file': return { path: params.path, action: 'restore', original_content: '...' }; // Snapshot logic would go here
      default: return null;
    }
  }
}

export const toolExecutor = new ToolExecutor();
