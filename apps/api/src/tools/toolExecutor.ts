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
import { rm, writeFile, readFile } from 'fs/promises';
import path from 'path';

function safePath(inputPath: string, allowedRoot: string): string {
  const resolved = path.resolve(inputPath);
  if (!resolved.startsWith(path.resolve(allowedRoot))) {
    throw new Error(`[Security] Path traversal blocked: ${inputPath}`);
  }
  return resolved;
}


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

      // 3. Cloud-to-Local Bridge Routing
      // If we are running on Google Cloud Run, certain tools must be shipped back to the local Mac
      const LOCAL_ONLY_TOOLS = ['write_file', 'create_folder', 'shell_execute', 'read_file', 'list_dir'];
      if (process.env.NODE_ENV === 'production' && LOCAL_ONLY_TOOLS.includes(toolName)) {
          const { hybridBridge } = await import('../services/hybridBridge.js');
          if (hybridBridge.isUp) {
              console.log(`[ToolExecutor] 🛰️ Routing local-only tool "${toolName}" to Hybrid Bridge...`);
              const bridgeResult = await hybridBridge.executeLocally(missionId, toolName, args);
              return bridgeResult;
          } else {
              console.warn(`[ToolExecutor] ⚠️ Running in Cloud mode but no Local Nerve Agent is connected. Execution may fail for ${toolName}.`);
          }
      }

      // 4. Emit "tool_started" event
      await eventBus.publish(missionId, {
        type: 'agent_working',
        taskId,
        taskLabel: taskId,
        message: `Executing tool: ${toolName}...`,
      } as any);

      // 5. Determine Undo Parameters (Saga Pattern)
      let undoParams = null;
      if (toolName === 'write_file') {
          try {
              const current = await tool.handler({ path: args.path }, { userId, workspaceId }); // Assume handler handles read if called with path only? No, use read_file.
              // Wait, I should use the specific tool for reading.
              const readTool = toolRegistry.getTool('read_file');
              if (readTool) {
                  const current = await readTool.handler({ path: args.path }, { userId, workspaceId });
                  undoParams = { path: args.path, original_content: current.content || '' };
              }
          } catch (e) {
              undoParams = { path: args.path, original_content: null }; // Indicates file didn't exist
          }
      } else {
          undoParams = await this.calculateUndoParams(toolName, args);
      }

      // 6. Log Action to Saga Store
      await sagaManager.logAction(missionId, toolName, args, undoParams);

      // 7. Run the handler
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
    }
  }

  /**
   * Reverses a previously logged action.
   */
  /**
   * Reverses a previously logged action by executing the inverse tool.
   */
  async undoAction(action: { tool_id: string, undo_params: any, goal_id: string }): Promise<any> {
    console.log(`[ToolExecutor] ⏪ Undoing: ${action.tool_id} (Mission: ${action.goal_id})`);
    
    if (!action.undo_params) {
      throw new Error(`Action "${action.tool_id}" has no registered undo parameters.`);
    }

    switch (action.tool_id) {
      case 'create_folder': {
        const safe = safePath(action.undo_params.path, process.cwd());
        await rm(safe, { recursive: true, force: false }); // force:false = won't silently eat errors
        break;
      }
      case 'write_file': {
        const safe = safePath(action.undo_params.path, process.cwd());
        if (action.undo_params.original_content !== undefined && action.undo_params.original_content !== null) {
          await writeFile(safe, action.undo_params.original_content, 'utf8');
        } else {
          await rm(safe, { force: false });
        }
        break;
      }
      default:
        throw new Error(`Critical: Undo logic not yet implemented for tool "${action.tool_id}"`);
    }
  }

  /**
   * Calculates the parameters required to reverse an action.
   */
  private async calculateUndoParams(tool: string, params: any): Promise<any> {
    switch (tool) {
      case 'create_folder': 
        return { path: params.path, action: 'delete' };
      case 'write_file': {
        let original_content: string | undefined;
        try {
          original_content = await readFile(params.path, 'utf8');
        } catch { original_content = undefined; } // file didn't exist before
        return { path: params.path, original_content };
      }
      default: 
        return null;
    }
  }
}

export const toolExecutor = new ToolExecutor();
