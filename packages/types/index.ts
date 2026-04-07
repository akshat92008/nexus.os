/**
 * @nexus-os/types — Shared TypeScript contract v2.0
 *
 * Extended for Week 2-3 redesign:
 *   - GoalType + TaskNode + TaskDAG  (replaces ExecutionPlan)
 *   - TypedArtifact union            (replaces raw Artifact.content: string)
 *   - New SSE events for waves, synthesis, retry
 *
 * All existing types (SubTask, Artifact, etc.) kept for backward compat
 * with frontend components that haven't migrated yet.
 */

// ── Legacy types (kept for backward compat) ────────────────────────────────

export type AgentType =
  | 'researcher'
  | 'analyst'
  | 'writer'
  | 'coder'
  | 'strategist'
  | 'summarizer'
  | 'chief_analyst'; // NEW

export type AgentStatus = 'idle' | 'spawned' | 'working' | 'handoff' | 'complete' | 'error' | 'skipped';
export type TaskMode = 'parallel' | 'sequential' | 'wave'; // wave is new
export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'excel';

/** Legacy SubTask — still used by planner fallback and old frontend paths */
export interface SubTask {
  id: string;
  label: string;
  agentType: AgentType;
}

/** Legacy Artifact — still emitted by artifact_deposited SSE for frontend compat */
export interface Artifact {
  agentId: string;
  taskLabel: string;
  agentType: AgentType;
  content: string;        // stringified TypedArtifact for compat
  tokensUsed: number;
  depositedAt: string;
}

// ── Goal Classification ────────────────────────────────────────────────────

export type GoalType =
  | 'lead_gen'
  | 'research'
  | 'content'
  | 'strategy'
  | 'analysis'
  | 'code'
  | 'general';

// ── Task DAG ───────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'locked' | 'running' | 'completed' | 'failed' | 'skipped';
export type OutputFormat = 'structured_json' | 'prose' | 'list' | 'code';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface OutputSchema {
  format: OutputFormat;
  fields?: Record<string, string>;   // field name → description (for structured_json)
  minItems?: number;                  // for list outputs
  example?: string;                   // one-line example of expected output shape
}

export interface TaskNode {
  id: string;
  label: string;
  agentType: AgentType;
  agentId?: string;                  // NEW: Specific agent from registry
  dependencies: string[];            // task IDs that must complete first ([] = wave 1)

  expectedOutput: OutputSchema;
  contextFields: string[];           // which prior task IDs' outputs to read
  goalAlignment: number;             // 0–1
  priority: TaskPriority;
  maxRetries: number;
  requiresApproval?: boolean;        // NEW: Strategic checkpoint for HITL
}

export interface TaskDAG {
  missionId: string;
  goal: string;
  goalType: GoalType;
  successCriteria: string[];         // measurable outcomes defining "done"
  nodes: TaskNode[];
  estimatedWaves: number;
}

// ── Typed Artifacts ────────────────────────────────────────────────────────

export interface ResearchFinding {
  insight: string;
  confidence: 'high' | 'medium' | 'low';
  source?: string;
}

export interface ResearchArtifact {
  format: 'structured_json';
  agentType: 'researcher';
  taskId: string;
  niche?: string;
  location?: string;
  findings: ResearchFinding[];
  keyEntities: string[];
  marketSize?: string;
  targetProfile?: string;
  painPoints?: string[];
  rawContent?: string;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface AnalysisArtifact {
  format: 'structured_json';
  agentType: 'analyst';
  taskId: string;
  swot?: SwotAnalysis;
  recommendations: string[];
  dataPoints: Array<{ label: string; value: string; confidence: string }>;
  recommendedNiche?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  rawContent?: string;
}

export interface StrategyArtifact {
  format: 'structured_json';
  agentType: 'strategist';
  taskId: string;
  executiveSummary: string;
  roadmap: Array<{ phase: string; actions: string[]; timeline: string }>;
  risks: Array<{ risk: string; mitigation: string }>;
  quickWins: string[];
  rawContent?: string;
}

export interface ContentArtifact {
  format: 'prose';
  agentType: 'writer';
  taskId: string;
  title?: string;
  body: string;
  wordCount: number;
  keywords?: string[];
  rawContent?: string;
}

export interface LeadProfile {
  name?: string;
  company: string;
  role: string;
  location: string;
  niche: string;
  painPoint: string;
  outreachHook: string;
  linkedInSearch: string;
  googleSearch?: string;
  dataSource: 'real' | 'estimated';
  verificationNote?: string;
}

export interface OutreachMessage {
  leadCompany: string;
  leadRole: string;
  subject: string;
  body: string;
  callToAction: string;
}

export interface LeadListArtifact {
  format: 'list';
  agentType: 'researcher';
  taskId: string;
  leads: LeadProfile[];
  outreachMessages?: OutreachMessage[];
  rawContent?: string;
}

export interface PipelineStage {
  name: string;
  duration: string;
  actions: string[];
  successMetric?: string;
}

export interface PipelineArtifact {
  format: 'structured_json';
  agentType: 'strategist';
  taskId: string;
  stages: PipelineStage[];
  recommendedCRM?: string;
  kpis?: string[];
  rawContent?: string;
}

export interface CodeArtifact {
  format: 'code';
  agentType: 'coder';
  taskId: string;
  language: string;
  code: string;
  explanation: string;
  rawContent?: string;
}

export interface CriterionResult {
  criterion: string;
  result: string;
  confidence: 'high' | 'medium' | 'low';
  met: boolean;
}

export interface KeyInsight {
  insight: string;
  supportingAgents: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ConflictResolution {
  topic: string;
  conflictDescription: string;
  resolution: string;
}

export interface NextStep {
  action: string;
  timeframe: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SynthesisArtifact {
  format: 'structured_json';
  agentType: 'chief_analyst';
  taskId: 'chief_analyst_synthesis';
  executiveSummary: string;
  criteriaResults: CriterionResult[];
  keyInsights: KeyInsight[];
  resolvedConflicts: ConflictResolution[];
  deliverable: Record<string, unknown>;  // domain-specific (leads[], pipeline{}, etc.)
  gaps: string[];
  nextSteps: NextStep[];
  rawContent?: string;
}

export type TypedArtifact =
  | ResearchArtifact
  | AnalysisArtifact
  | StrategyArtifact
  | ContentArtifact
  | LeadListArtifact
  | PipelineArtifact
  | CodeArtifact
  | SynthesisArtifact;

// ── Workspace System types (Unified Work OS) ──────────────────────────────

export type WorkspaceSectionType = 'document' | 'table' | 'tasklist' | 'timeline' | 'insight' | 'kanban';


export interface WorkspaceTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'done';
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface WorkspaceSection {
  id: string;
  type: WorkspaceSectionType;
  title: string;
  content: any; // polymorphic: string for docs, string[] for insights, LeadProfile[] for tables, etc.
  description?: string;
}

export interface NextAction {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: 'execute' | 'review' | 'follow-up';
  relatedSectionId: string;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  type: 'execution' | 'update' | 'user_action';
  message: string;
}

export interface OngoingMission {
  id: string;
  goal: string;
  status: 'active' | 'paused';
  lastRun: number;
  nextRun: number;
  workspaceId: string;
}

export interface Workspace {
  id: string;
  goal: string;
  goalType: GoalType;
  sections: WorkspaceSection[];
  createdAt: number;
  nextActions?: NextAction[];
  activityLog?: ActivityLog[];
  metadata?: Record<string, unknown>;
}

export interface WorkspaceWorkflow {
  id: string;
  name: string;
  goalTemplate: string;
  lastUsedAt: number;
}

// ── Persisted User State (MVP foundation) ─────────────────────────────────

export type NotificationType = 'system' | 'agent' | 'email' | 'alert';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface NexusInboxEntry {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  timestamp: string;
  read: boolean;
  priority: NotificationPriority;
}

export type ApplicationWindowType =
  | 'lead_engine'
  | 'research_lab'
  | 'strategy_board'
  | 'code_studio'
  | 'content_engine'
  | 'learning_workspace'
  | 'financial_dashboard'
  | 'time_tracker'
  | 'invoicing'
  | 'calendar'
  | 'general';

export interface AppWindowState {
  workspaceId: string;
  windowType: ApplicationWindowType;
  title: string;
  isBackground: boolean;
  isPinned: boolean;
  openedAt: number;
}

export type FinanceRecordType = 'income' | 'expense';

export interface FinanceRecord {
  id: string;
  type: FinanceRecordType;
  amount: number;
  category: string;
  label: string;
  date: number;
  note?: string;
}

export interface FinancialBreakdownItem {
  source?: string;
  category?: string;
  label?: string; // fallback
  amount: number;
}

export interface FinancialState {
  revenue: number;
  expenses: number;
  profit: number;
  cashPosition: number;
  runway: number;
  revenueTrend: number[];
  topRevenueSources: FinancialBreakdownItem[];
  topExpenses: FinancialBreakdownItem[];
  records: FinanceRecord[];
}

export interface ActiveTimeEntry {
  id: string;
  taskId: string;
  startTime: number;
  label: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  label: string;
  durationMs: number;
  endTime: number;
  workspaceId: string;
}

export interface TimeTrackingState {
  activeEntry: ActiveTimeEntry | null;
  recentEntries: TimeEntry[];
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  client: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  date: number;
  dueDate: number;
  notes?: string;
  lineItems?: InvoiceLineItem[];
}

export interface InvoicingState {
  invoices: InvoiceRecord[];
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  location?: string;
  attendees?: string[];
  type: 'meeting' | 'task' | 'reminder';
  notes?: string;
}

export interface CalendarState {
  events: CalendarEventRecord[];
}

export interface ScheduleSnapshot {
  scheduleId: string;
  workspaceId: string;
  goal: string;
  frequency: string;
  nextRun: number;
  lastRun: number | null;
  enabled: boolean;
  runCount: number;
  cron?: string;
  triggerType?: string;
  intervalMs?: number;
  createdAt?: number;
  maxRuns?: number;
}

export interface UserStateSnapshot {
  userId: string;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  appWindows: AppWindowState[];
  schedules: ScheduleSnapshot[];
  ongoingMissions: OngoingMission[];
  inbox: NexusInboxEntry[];
  installedAgentIds: string[];
  finances: FinancialState;
  timeTracking: TimeTrackingState;
  invoicing: InvoicingState;
  calendar: CalendarState;
  updatedAt: number;
}

// ── Mission Memory Entry ───────────────────────────────────────────────────

export interface MemoryEntry {
  key: string;           // e.g. "artifact:research_delhi_01"
  taskId: string;
  agentType: AgentType;
  data: TypedArtifact;
  writtenAt: number;
  tokensUsed: number;
  tags?: string[];       // Semantic tags for graph retrieval
  semanticHash?: string; // Optional: vector representation identifier
}

export interface AgentContext {
  entries: MemoryEntry[];
  promptBlock: string;   // formatted context ready for injection into prompt
}

// ── Task Registry ──────────────────────────────────────────────────────────

export interface TaskRecord {
  taskId: string;
  missionId: string;
  status: TaskStatus;
  attemptCount: number;
  lockedAt?: number;
  completedAt?: number;
  errorMessage?: string;
  outputKey?: string;
}

// ── Ledger Types (unchanged) ───────────────────────────────────────────────

export interface LedgerRow {
  id: string;
  user_id: string;
  agent_id: string;
  task_type: string;
  task_label: string;
  tokens_used: number;
  fee_usd: number;
  created_at: string;
}

export interface LedgerSummary {
  userId: string;
  totalFeeUsd: number;
  transactionCount: number;
  totalTokensUsed: number;
  rows: LedgerRow[];
}

// ── SSE Event Union ────────────────────────────────────────────────────────

export interface ConnectedEvent {
  type: 'connected';
  message: string;
  sessionId: string;
}

// Updated plan_ready now includes DAG info alongside legacy compat fields
export interface PlanReadyEvent {
  type: 'plan_ready';
  parallelCount: number;
  sequentialCount: number;
  waveCount: number;                               // NEW
  nodeCount: number;                               // NEW
  goalType: GoalType;                              // NEW
  successCriteria: string[];                       // NEW
  tasks: { parallel: SubTask[]; sequential: SubTask[] }; // kept for compat
  estimatedFeeUsd: number;
}

export interface WaveStartEvent {                  // NEW
  type: 'wave_start';
  waveIndex: number;
  taskCount: number;
  taskIds: string[];
}

export interface WaveCompleteEvent {               // NEW
  type: 'wave_complete';
  waveIndex: number;
  succeeded: number;
  failed: number;
}

export interface RetryWaveEvent {                  // NEW
  type: 'retry_wave';
  retryCount: number;
  taskIds: string[];
}

export interface SynthesisStartEvent {             // NEW
  type: 'synthesis_start';
  conflictsDetected: number;
}

export interface AgentSpawnEvent {
  type: 'agent_spawn';
  taskId: string;
  taskLabel: string;
  agentType: AgentType;
  agentId?: string;                                // NEW
  mode: TaskMode;
  waveIndex?: number;                              // NEW
}

export interface AgentWorkingEvent {
  type: 'agent_working';
  taskId: string;
  taskLabel: string;
  message: string;
}

export interface ArtifactDepositedEvent {
  type: 'artifact_deposited';
  agentId: string;
  taskLabel: string;
  agentType: AgentType;
  preview: string;
  tokensUsed: number;
  depositedAt: string;
  outputFormat?: OutputFormat;                     // NEW
}

export interface HandoffEvent {
  type: 'handoff';
  fromAgentId: string;
  toAgentId: string;
  artifactCount: number;
}

export interface LedgerUpdateEvent {
  type: 'ledger_update';
  userId: string;
  agentId: string;
  taskLabel: string;
  taskType: string;
  tokensUsed: number;
  feeUsd: number;
  cumulativeFeeUsd: number;
  createdAt: string;
}

export interface DoneEvent {
  type: 'done';
  message: string;
  totalAgents: number;
  totalFeeUsd: number;
  totalTokensUsed: number;
  userId: string;
  sessionId: string;
  durationMs: number;
  synthesisAvailable: boolean;
  workspace?: Workspace;                           // NEW
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  taskId?: string;
  code?: string;
}

export interface SystemPauseEvent {
  type: 'system_pause';
  pauseUntil: number;
  reason: string;
}

export interface AwaitingApprovalEvent {
  type: 'awaiting_approval';
  taskId: string;
  taskLabel: string;
  reason?: string;
}
 
export type NexusSSEEvent =
  | ConnectedEvent
  | PlanReadyEvent
  | WaveStartEvent
  | WaveCompleteEvent
  | RetryWaveEvent
  | SynthesisStartEvent
  | AgentSpawnEvent
  | AgentWorkingEvent
  | ArtifactDepositedEvent
  | HandoffEvent
  | LedgerUpdateEvent
  | DoneEvent
  | ErrorEvent
  | SystemPauseEvent
  | AwaitingApprovalEvent;

// ── API Request / Response ─────────────────────────────────────────────────

export interface OrchestrateRequest {
  goal: string;
  userId: string;
}

// ── NexusFS Smart File System ──────────────────────────────────────────────

export type FileCategory = 'document' | 'spreadsheet' | 'presentation' | 'image' | 'video' | 'code' | 'archive' | 'other';

export interface NexusFileMetadata {
  category: FileCategory;
  tags: string[];
  aiSummary?: string;
  isEncrypted: boolean;
  version: number;
  lastAccessedAt: number;
  tokensIndexed?: number;
}

export interface NexusFile {
  id: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string;
  path: string;
  parentId: string | null;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  metadata: NexusFileMetadata;
  contentUrl?: string; // S3/Supabase Storage link
}

export interface NexusFolder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}


export interface HealthResponse {

  status: 'ok' | 'degraded';
  version: string;
  engine: string;
   GroqKeyPresent: boolean;
  supabaseConnected: boolean;
  timestamp: string;
}
 
// ── Graph Data (React-Flow Compat) ──────────────────────────────────────────
 
export interface GraphNode {
  id: string;
  type: string;
  data: { label: string; agentType: AgentType; status: TaskStatus; artifact?: any };
  position: { x: number; y: number };
}
 
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}
 
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
