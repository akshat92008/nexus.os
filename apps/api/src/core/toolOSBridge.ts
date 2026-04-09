import { ToolInterface, ToolRequest, ToolResponse } from './toolInterface.js';
import { toolRegistry } from '../tools/toolRegistry.js';

/**
 * ToolOSBridge is the OS-level implementation of the tool interface.
 * It routes generic ToolRequests to the specialized handlers in toolRegistry.
 */
class ToolOSBridge implements ToolInterface {
  async requestTool(req: ToolRequest): Promise<ToolResponse> {
    console.log(`[ToolOSBridge] 🛠️ Tool requested: ${req.type}`);
    
    try {
      const tool = toolRegistry.getTool(req.type);
      if (!tool) {
        return { success: false, error: `Tool "${req.type}" not found in OS registry.` };
      }

      // Execute tool handler via the registry
      const data = await tool.handler(req.payload);
      
      return { success: true, data };
    } catch (err: any) {
      console.error(`[ToolOSBridge] ❌ Tool execution failed: ${req.type}`, err);
      return { success: false, error: err.message };
    }
  }
}

export const toolOSBridge = new ToolOSBridge();
