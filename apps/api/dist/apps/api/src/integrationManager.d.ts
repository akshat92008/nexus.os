/**
 * Agentic OS — Integration OS Layer (Tool Abstraction Layer V2)
 *
 * Full tool abstraction layer with:
 *   - Tool interface (execute, validate, requiresApproval)
 *   - Permission system per workspace
 *   - Action validation & approval flow
 *   - Concrete simulated tools: email, notion, CRM, GitHub, calendar
 *
 * Real API keys can be injected via environment variables to activate live tools.
 */
export type ToolCategory = 'communication' | 'document' | 'crm' | 'code' | 'calendar' | 'data' | 'analytics';
export type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';
export interface ToolParams {
    [key: string]: string | number | boolean | string[] | undefined;
}
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    simulatedAt?: number;
}
export interface Tool {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    riskLevel: RiskLevel;
    requiresApproval: boolean;
    paramSchema: Record<string, {
        type: string;
        required: boolean;
        description: string;
    }>;
    validate: (params: ToolParams) => string | null;
    execute: (params: ToolParams, workspaceId: string) => Promise<ToolResult>;
}
export interface PendingApproval {
    id: string;
    toolId: string;
    params: ToolParams;
    workspaceId: string;
    requestedAt: number;
    status: 'pending' | 'approved' | 'rejected';
    resolvedAt?: number;
}
export declare function grantPermission(workspaceId: string, toolId: string): void;
export declare function revokePermission(workspaceId: string, toolId: string): void;
export declare function hasPermission(workspaceId: string, toolId: string): boolean;
export declare function getWorkspaceTools(workspaceId: string): string[];
export declare function initWorkspacePermissions(workspaceId: string): void;
export declare function queueApproval(toolId: string, params: ToolParams, workspaceId: string): PendingApproval;
export declare function resolveApproval(approvalId: string, approved: boolean): boolean;
export declare function listPendingApprovals(workspaceId?: string): PendingApproval[];
export declare function getTool(id: string): Tool | undefined;
export declare function listTools(): Tool[];
export declare function listToolsByCategory(category: ToolCategory): Tool[];
export declare function executeIntegration(toolId: string, params: ToolParams, workspaceId: string, skipApproval?: boolean): Promise<ToolResult & {
    approvalId?: string;
}>;
/**
 * runActionImplementation
 *
 * High-level dispatcher for Next Actions.
 * In a production system, this would resolve the actionId to a Tool + Params.
 */
export declare function runActionImplementation(actionId: string, workspaceId: string): Promise<{
    success: boolean;
    message: string;
    title: string;
}>;
//# sourceMappingURL=integrationManager.d.ts.map