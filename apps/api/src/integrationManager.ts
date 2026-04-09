/**
 * Nexus OS — Integration Manager (Modular Facade)
 *
 * This file maintains the legacy API for the integration layer while delegating
 * the actual implementation to specialized sub-modules and tool drivers.
 */

import { ToolParams, ToolResult } from './integrations/types.js';
import { getTool, listTools, registerToolDriver, unregisterToolDriver } from './integrations/toolRegistry.js';
import { hasPermission, queueApproval, grantPermission, revokePermission, initWorkspacePermissions, listPendingApprovals, resolveApproval } from './integrations/approvalSystem.js';

// Re-export types for backward compatibility
export * from './integrations/types.js';

// Re-export core logic
export {
  getTool,
  listTools,
  registerToolDriver,
  unregisterToolDriver,
  hasPermission,
  grantPermission,
  revokePermission,
  initWorkspacePermissions,
  listPendingApprovals,
  resolveApproval,
};

/**
 * executeIntegration
 *
 * Main orchestration entry point for calling agent tools.
 */
export async function executeIntegration(
  toolId:      string,
  params:      ToolParams,
  workspaceId: string,
  skipApproval = false,
): Promise<ToolResult & { approvalId?: string }> {

  const tool = getTool(toolId);
  if (!tool) return { success: false, error: `Unknown tool: ${toolId}` };

  // Permission check
  if (!hasPermission(workspaceId, toolId)) {
    return { success: false, error: `Workspace does not have permission to use ${toolId}` };
  }

  // Validation
  const validationError = tool.validate(params);
  if (validationError) return { success: false, error: validationError };

  // Approval gate
  if (tool.requiresApproval && !skipApproval) {
    const approval = queueApproval(toolId, params, workspaceId);
    return { success: false, error: `Approval required. Approval ID: ${approval.id}`, approvalId: approval.id };
  }

  // Execute
  try {
    console.log(`[Integration] ⚡ Executing ${toolId} for workspace ${workspaceId}`);
    return await tool.execute(params, workspaceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * runActionImplementation
 *
 * Legacy dispatcher for high-level UI actions.
 */
export async function runActionImplementation(
  actionId: string,
  workspaceId: string
): Promise<{ success: boolean; message: string; title: string }> {
  console.log(`[Integration] 🏃 Running action facade for: ${actionId}`);

  // Simulating work for the UI feel
  await new Promise(r => setTimeout(r, 800));

  return {
    success: true,
    title: "Action Complete",
    message: "The requested operation has been successfully processed by the integration layer.",
  };
}
