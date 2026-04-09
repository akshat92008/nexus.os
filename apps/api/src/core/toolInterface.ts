/**
 * Nexus OS — Universal Tool Interface
 * 
 * This layer abstracts how agents request and execute tools.
 * It ensures that tools are treated as OS primitives rather than
 * direct library calls.
 */

export interface ToolRequest {
  type: string;
  payload: any;
}

export interface ToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * The OS Tool Bridge that agents interact with.
 */
export interface ToolInterface {
  /**
   * Request the execution of a tool by its universal type/name.
   */
  requestTool(req: ToolRequest): Promise<ToolResponse>;
}
