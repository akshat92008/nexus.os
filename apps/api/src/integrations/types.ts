export type ToolCategory =
  | 'communication'
  | 'document'
  | 'crm'
  | 'code'
  | 'calendar'
  | 'data'
  | 'analytics';

export type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export interface ToolParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface ToolResult {
  success:   boolean;
  data?:     unknown;
  error?:    string;
  simulatedAt?: number;
}

export interface Tool {
  id:               string;
  name:             string;
  description:      string;
  category:         ToolCategory;
  riskLevel:        RiskLevel;
  requiresApproval: boolean;
  paramSchema:      Record<string, { type: string; required: boolean; description: string }>;
  validate:         (params: ToolParams) => string | null;
  execute:          (params: ToolParams, workspaceId: string) => Promise<ToolResult>;
}

export interface PendingApproval {
  id:          string;
  toolId:      string;
  params:      ToolParams;
  workspaceId: string;
  requestedAt: number;
  status:      'pending' | 'approved' | 'rejected';
  resolvedAt?: number;
}
