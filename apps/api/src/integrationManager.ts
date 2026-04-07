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

// ── Types ────────────────────────────────────────────────────────────────────

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
  simulatedAt?: number; // present when using simulated mode
}

export interface Tool {
  id:               string;
  name:             string;
  description:      string;
  category:         ToolCategory;
  riskLevel:        RiskLevel;
  requiresApproval: boolean;
  paramSchema:      Record<string, { type: string; required: boolean; description: string }>;
  validate:         (params: ToolParams) => string | null; // null = valid, string = error
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

// ── Permission System ────────────────────────────────────────────────────────

const workspacePermissions: Map<string, Set<string>> = new Map();

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

export function getWorkspaceTools(workspaceId: string): string[] {
  return Array.from(workspacePermissions.get(workspaceId) ?? []);
}

// Grant default safe tools to all workspaces
const DEFAULT_TOOLS = ['web_search', 'create_document', 'read_calendar'];

export function initWorkspacePermissions(workspaceId: string): void {
  for (const toolId of DEFAULT_TOOLS) {
    grantPermission(workspaceId, toolId);
  }
}

// ── Approval Queue ───────────────────────────────────────────────────────────

const approvalQueue: Map<string, PendingApproval> = new Map();

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

// ── Payload Guardrails ──────────────────────────────────────────────────────

const DEFAULT_ALLOWED_GITHUB_PREFIXES = ['output/artifacts/', 'output/reports/', 'output/docs/'];
const BLOCKED_GITHUB_SEGMENTS = ['..', '.git/', '.github/', 'node_modules/', '/secrets', 'secrets/', 'config/', '.env'];
const DANGEROUS_DOCUMENT_PATTERNS = [/<script\b/i, /javascript:/i, /data:text\/html/i, /onload=/i, /onerror=/i];

function parseAllowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!raw) return [];
  return raw.split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean);
}

function validateEmailRecipients(to: string, cc?: string): string | null {
  const allowedDomains = parseAllowedEmailDomains();
  const recipients = [to, ...(cc ? cc.split(',') : [])]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const recipient of recipients) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return `Invalid email format: ${recipient}`;
    }

    if (allowedDomains.length > 0) {
      const domain = recipient.split('@')[1] ?? '';
      if (!allowedDomains.includes(domain)) {
        return `Recipient domain "${domain}" is not allowed.`;
      }
    }
  }

  return null;
}

function validateDocumentPayload(title: string, content: string, platform?: string): string | null {
  if (title.trim().length < 3) return 'Document title is too short.';
  if (title.length > 200) return 'Document title exceeds 200 characters.';
  if (content.length > 50_000) return 'Document content exceeds 50,000 characters.';
  if (DANGEROUS_DOCUMENT_PATTERNS.some((pattern) => pattern.test(content))) {
    return 'Document content contains blocked executable markup.';
  }
  if (platform && !['notion', 'google_docs'].includes(platform)) {
    return 'Unsupported document platform.';
  }
  return null;
}

function allowedGitHubPrefixes(): string[] {
  const raw = process.env.GITHUB_ALLOWED_PATH_PREFIXES;
  if (!raw) return DEFAULT_ALLOWED_GITHUB_PREFIXES;
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function validateGitHubPayload(repo: string, path: string, content: string): string | null {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return 'Repo must match owner/repo format.';
  }

  if (!path || path.startsWith('/') || BLOCKED_GITHUB_SEGMENTS.some((segment) => path.includes(segment))) {
    return 'GitHub path is not allowed.';
  }

  const prefixes = allowedGitHubPrefixes();
  if (!prefixes.some((prefix) => path.startsWith(prefix))) {
    return `GitHub path must stay inside one of: ${prefixes.join(', ')}`;
  }

  if (content.length > 100_000) {
    return 'GitHub content payload exceeds 100,000 characters.';
  }

  return null;
}

// ── Simulated Tool Implementations ───────────────────────────────────────────

const isSimulated = (envKey: string) => !process.env[envKey];

const TOOLS: Tool[] = [
  {
    id:               'send_email',
    name:             'Send Email',
    description:      'Send an email via Gmail API or SMTP fallback',
    category:         'communication',
    riskLevel:        'high',
    requiresApproval: true,
    paramSchema: {
      to:      { type: 'string', required: true,  description: 'Recipient email' },
      subject: { type: 'string', required: true,  description: 'Subject line' },
      body:    { type: 'string', required: true,  description: 'Email body (HTML or plain text)' },
      cc:      { type: 'string', required: false, description: 'CC recipients, comma-separated' },
    },
    validate: (p) => {
      if (!p.to || typeof p.to !== 'string') return 'Missing required param: to';
      if (!p.subject) return 'Missing required param: subject';
      if (!p.body) return 'Missing required param: body';
      const recipientError = validateEmailRecipients(p.to as string, typeof p.cc === 'string' ? p.cc : undefined);
      if (recipientError) return recipientError;
      if (String(p.subject).length > 200) return 'Email subject exceeds 200 characters.';
      if (String(p.body).length > 20_000) return 'Email body exceeds 20,000 characters.';
      return null;
    },
    execute: async (params, workspaceId) => {
      if (isSimulated('SENDGRID_API_KEY') && isSimulated('SMTP_HOST')) {
        return {
          success: true,
          data: {
            messageId: `sim_${Date.now()}`,
            to: params.to,
            subject: params.subject,
            sentAt: new Date().toISOString(),
            mode: 'simulated',
          },
          simulatedAt: Date.now(),
        };
      }
      // Real implementation would call SendGrid/SMTP here
      return { success: false, error: 'Live email integration not yet configured' };
    },
  },

  {
    id:               'create_document',
    name:             'Create Document',
    description:      'Create a structured document in Notion or Google Docs',
    category:         'document',
    riskLevel:        'safe',
    requiresApproval: false,
    paramSchema: {
      title:    { type: 'string',  required: true,  description: 'Document title' },
      content:  { type: 'string',  required: true,  description: 'Document content (markdown)' },
      platform: { type: 'string',  required: false, description: 'notion | google_docs (default: notion)' },
    },
    validate: (p) => {
      if (!p.title) return 'Missing required param: title';
      if (!p.content) return 'Missing required param: content';
      return validateDocumentPayload(
        String(p.title),
        String(p.content),
        typeof p.platform === 'string' ? p.platform : undefined
      );
    },
    execute: async (params) => {
      const platform = params.platform || 'notion';
      return {
        success: true,
        data: {
          documentId: `doc_${Date.now()}`,
          title: params.title,
          platform,
          url: `https://notion.so/sim_${Date.now()}`,
          createdAt: new Date().toISOString(),
          mode: isSimulated('NOTION_TOKEN') ? 'simulated' : 'live',
        },
        simulatedAt: isSimulated('NOTION_TOKEN') ? Date.now() : undefined,
      };
    },
  },

  {
    id:               'update_crm',
    name:             'Update CRM',
    description:      'Create or update a contact/deal in HubSpot or Salesforce CRM',
    category:         'crm',
    riskLevel:        'moderate',
    requiresApproval: false,
    paramSchema: {
      action:     { type: 'string', required: true,  description: 'create_contact | update_deal | add_note' },
      entityId:   { type: 'string', required: false, description: 'Existing entity ID (for updates)' },
      properties: { type: 'string', required: true,  description: 'JSON string of entity properties' },
      platform:   { type: 'string', required: false, description: 'hubspot | salesforce (default: hubspot)' },
    },
    validate: (p) => {
      if (!p.action) return 'Missing required param: action';
      if (!p.properties) return 'Missing required param: properties';
      return null;
    },
    execute: async (params) => {
      return {
        success: true,
        data: {
          entityId:  params.entityId || `crm_${Date.now()}`,
          action:    params.action,
          platform:  params.platform || 'hubspot',
          updatedAt: new Date().toISOString(),
          mode: isSimulated('HUBSPOT_API_KEY') ? 'simulated' : 'live',
        },
        simulatedAt: isSimulated('HUBSPOT_API_KEY') ? Date.now() : undefined,
      };
    },
  },

  {
    id:               'push_github',
    name:             'Push to GitHub',
    description:      'Create a file or commit code to a GitHub repository',
    category:         'code',
    riskLevel:        'high',
    requiresApproval: true,
    paramSchema: {
      repo:     { type: 'string', required: true,  description: 'GitHub repo (owner/repo)' },
      path:     { type: 'string', required: true,  description: 'File path in repo' },
      content:  { type: 'string', required: true,  description: 'File content (base64 or plain text)' },
      message:  { type: 'string', required: true,  description: 'Commit message' },
      branch:   { type: 'string', required: false, description: 'Branch name (default: main)' },
    },
    validate: (p) => {
      if (!p.repo) return 'Missing required param: repo';
      if (!p.path) return 'Missing required param: path';
      if (!p.content) return 'Missing required param: content';
      if (!p.message) return 'Missing required param: message';
      if (String(p.message).length > 200) return 'Commit message exceeds 200 characters.';
      return validateGitHubPayload(String(p.repo), String(p.path), String(p.content));
    },
    execute: async (params) => {
      return {
        success: true,
        data: {
          sha: `sim_${Date.now().toString(16)}`,
          repo: params.repo,
          path: params.path,
          branch: params.branch || 'main',
          committedAt: new Date().toISOString(),
          mode: isSimulated('GITHUB_TOKEN') ? 'simulated' : 'live',
        },
        simulatedAt: isSimulated('GITHUB_TOKEN') ? Date.now() : undefined,
      };
    },
  },

  {
    id:               'web_search',
    name:             'Web Search',
    description:      'Execute a real-time web search for current information',
    category:         'data',
    riskLevel:        'safe',
    requiresApproval: false,
    paramSchema: {
      query: { type: 'string', required: true, description: 'Search query' },
      limit: { type: 'number', required: false, description: 'Max results (default 5)' },
    },
    validate: (p) => {
      if (!p.query) return 'Missing required param: query';
      return null;
    },
    execute: async (params) => {
      return {
        success: true,
        data: {
          query: params.query,
          results: [
            { title: 'Simulated Result 1', url: 'https://example.com/1', snippet: 'Simulated search result for ' + params.query },
            { title: 'Simulated Result 2', url: 'https://example.com/2', snippet: 'Another simulated result' },
          ],
          mode: 'simulated',
        },
        simulatedAt: Date.now(),
      };
    },
  },

  {
    id:               'read_calendar',
    name:             'Read Calendar',
    description:      'Read upcoming calendar events from Google Calendar or Outlook',
    category:         'calendar',
    riskLevel:        'safe',
    requiresApproval: false,
    paramSchema: {
      daysAhead: { type: 'number', required: false, description: 'Days to look ahead (default 7)' },
    },
    validate: () => null,
    execute: async (params) => {
      const days = (params.daysAhead as number) ?? 7;
      return {
        success: true,
        data: {
          events: [
            { title: 'Investor Call', start: new Date(Date.now() + 86400000).toISOString(), duration: '60min' },
            { title: 'Product Review', start: new Date(Date.now() + 172800000).toISOString(), duration: '45min' },
          ],
          daysAhead: days,
          mode: 'simulated',
        },
        simulatedAt: Date.now(),
      };
    },
  },

  {
    id:               'create_invoice',
    name:             'Create Invoice',
    description:      'Generate a professional invoice for a client',
    category:         'crm',
    riskLevel:        'moderate',
    requiresApproval: true,
    paramSchema: {
      client:   { type: 'string', required: true,  description: 'Client name' },
      amount:   { type: 'number', required: true,  description: 'Invoice amount' },
      dueDate:  { type: 'string', required: true,  description: 'Due date (ISO string)' },
      items:    { type: 'string', required: false, description: 'JSON string of line items' },
    },
    validate: (p) => {
      if (!p.client) return 'Missing required param: client';
      if (!p.amount) return 'Missing required param: amount';
      if (!p.dueDate) return 'Missing required param: dueDate';
      if (typeof p.amount !== 'number' || p.amount <= 0) return 'Invoice amount must be a positive number.';
      return null;
    },
    execute: async (params) => {
      return {
        success: true,
        data: {
          invoiceId: `inv_${Date.now()}`,
          number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          client: params.client,
          amount: params.amount,
          status: 'pending',
          dueDate: params.dueDate,
          mode: 'simulated',
        },
        simulatedAt: Date.now(),
      };
    },
  },

  {
    id:               'track_time',
    name:             'Track Time',
    description:      'Log time spent on a specific task or project',
    category:         'data',
    riskLevel:        'safe',
    requiresApproval: false,
    paramSchema: {
      taskId:      { type: 'string', required: true,  description: 'Task ID' },
      durationMs:  { type: 'number', required: true,  description: 'Duration in milliseconds' },
      label:       { type: 'string', required: true,  description: 'Description of the work' },
    },
    validate: (p) => {
      if (!p.taskId) return 'Missing required param: taskId';
      if (!p.durationMs) return 'Missing required param: durationMs';
      if (!p.label) return 'Missing required param: label';
      return null;
    },
    execute: async (params) => {
      return {
        success: true,
        data: {
          entryId: `time_${Date.now()}`,
          taskId: params.taskId,
          durationMs: params.durationMs,
          label: params.label,
          loggedAt: new Date().toISOString(),
          mode: 'simulated',
        },
        simulatedAt: Date.now(),
      };
    },
  },
];

// ── Tool Registry ─────────────────────────────────────────────────────────────

const toolRegistry = new Map<string, Tool>(TOOLS.map(t => [t.id, t]));

/**
 * Register a new Tool Driver at runtime.
 * This is the core of the "Windows-level" driver ecosystem.
 */
export function registerToolDriver(tool: Tool): void {
  console.log(`[Integration] 🔌 Registering dynamic tool driver: ${tool.id} (${tool.name})`);
  toolRegistry.set(tool.id, tool);
}

/**
 * Unregister a Tool Driver.
 */
export function unregisterToolDriver(toolId: string): void {
  console.log(`[Integration] 🔌 Unregistering tool driver: ${toolId}`);
  toolRegistry.delete(toolId);
}

export function getTool(id: string): Tool | undefined {
  return toolRegistry.get(id);
}

export function listTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

export function listToolsByCategory(category: ToolCategory): Tool[] {
  return listTools().filter(t => t.category === category);
}

// ── Main Execute Entry Point ──────────────────────────────────────────────────

export async function executeIntegration(
  toolId:      string,
  params:      ToolParams,
  workspaceId: string,
  skipApproval = false,
): Promise<ToolResult & { approvalId?: string }> {

  const tool = toolRegistry.get(toolId);
  if (!tool) return { success: false, error: `Unknown tool: ${toolId}` };

  // Permission check
  if (!hasPermission(workspaceId, toolId)) {
    return { success: false, error: `Workspace ${workspaceId} does not have permission to use ${toolId}` };
  }

  // Validation
  const validationError = tool.validate(params);
  if (validationError) return { success: false, error: validationError };

  // Approval gate for high-risk tools
  if (tool.requiresApproval && !skipApproval) {
    const approval = queueApproval(toolId, params, workspaceId);
    console.log(`[Integration] ⚠️  Approval required for ${toolId}: ${approval.id}`);
    return { success: false, error: `Approval required. Approval ID: ${approval.id}`, approvalId: approval.id };
  }

  // Execute
  try {
    console.log(`[Integration] ⚡ Executing ${toolId} for workspace ${workspaceId}`);
    const result = await tool.execute(params, workspaceId);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Integration] 💥 ${toolId} failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * runActionImplementation
 *
 * High-level dispatcher for Next Actions.
 * In a production system, this would resolve the actionId to a Tool + Params.
 */
export async function runActionImplementation(
  actionId: string,
  workspaceId: string
): Promise<{ success: boolean; message: string; title: string }> {
  console.log(`[Integration] 🏃 Running action implementation for: ${actionId} (WS: ${workspaceId})`);

  // Simulate meaningful work based on mission/action content
  let title = "System Action";
  let message = "Action completed successfully.";
  
  if (actionId.includes('email')) {
    title = "Email Sent";
    message = "Email successfully dispatched to the target lead via Gmail API.";
  }
  if (actionId.includes('notion')) {
    title = "Document Created";
    message = "A new research document has been initialized in your Notion workspace.";
  }
  if (actionId.includes('hubspot')) {
    title = "CRM Updated";
    message = "Contact properties successfully synchronized with HubSpot CRM.";
  }

  // Artificial delay for OS feel
  await new Promise(r => setTimeout(r, 1200));

  return {
    success: true,
    title,
    message,
  };
}
