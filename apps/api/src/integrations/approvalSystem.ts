import { PendingApproval, ToolParams } from './types.js';

const workspacePermissions: Map<string, Set<string>> = new Map();
const DEFAULT_TOOLS = ['web_search', 'create_document', 'read_calendar'];

export function grantPermission(workspaceId: string, toolId: string): void {
  if (!workspacePermissions.has(workspaceId)) {
    workspacePermissions.set(workspaceId, new Set());
  }
  workspacePermissions.get(workspaceId)!.add(toolId);
}

export function revokePermission(workspaceId: string, toolId: string): void {
  workspacePermissions.get(workspaceId)?.delete(toolId);
}

export function hasPermission(workspaceId: string, toolId: string): boolean {
  return workspacePermissions.get(workspaceId)?.has(toolId) ?? false;
}

export function initWorkspacePermissions(workspaceId: string): void {
  for (const toolId of DEFAULT_TOOLS) {
    grantPermission(workspaceId, toolId);
  }
}

// ── Approval Queue ───────────────────────────────────────────────────────────

export const approvalQueue: Map<string, PendingApproval> = new Map();

export function queueApproval(toolId: string, params: ToolParams, workspaceId: string): PendingApproval {
  const approval: PendingApproval = {
    id:          `appr_${crypto.randomUUID().slice(0, 8)}`,
    toolId,
    params,
    workspaceId,
    requestedAt: Date.now(),
    status:      'pending',
  };
  approvalQueue.set(approval.id, approval);
  return approval;
}

export function resolveApproval(approvalId: string, approved: boolean): boolean {
  const appr = approvalQueue.get(approvalId);
  if (!appr || appr.status !== 'pending') return false;
  appr.status = approved ? 'approved' : 'rejected';
  appr.resolvedAt = Date.now();
  return true;
}

export function listPendingApprovals(workspaceId?: string): PendingApproval[] {
  return Array.from(approvalQueue.values()).filter(a =>
    a.status === 'pending' && (!workspaceId || a.workspaceId === workspaceId)
  );
}
