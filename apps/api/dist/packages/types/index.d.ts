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
export type AgentType = 'researcher' | 'analyst' | 'writer' | 'coder' | 'strategist' | 'summarizer' | 'chief_analyst';
export type AgentStatus = 'idle' | 'spawned' | 'working' | 'handoff' | 'complete' | 'error' | 'skipped';
export type TaskMode = 'parallel' | 'sequential' | 'wave';
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
    content: string;
    tokensUsed: number;
    depositedAt: string;
}
export type GoalType = 'lead_gen' | 'research' | 'content' | 'strategy' | 'analysis' | 'code' | 'general';
export type TaskStatus = 'pending' | 'locked' | 'running' | 'completed' | 'failed' | 'skipped';
export type OutputFormat = 'structured_json' | 'prose' | 'list' | 'code';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export interface OutputSchema {
    format: OutputFormat;
    fields?: Record<string, string>;
    minItems?: number;
    example?: string;
}
export interface TaskNode {
    id: string;
    label: string;
    agentType: AgentType;
    agentId?: string;
    dependencies: string[];
    expectedOutput: OutputSchema;
    contextFields: string[];
    goalAlignment: number;
    priority: TaskPriority;
    maxRetries: number;
}
export interface TaskDAG {
    missionId: string;
    goal: string;
    goalType: GoalType;
    successCriteria: string[];
    nodes: TaskNode[];
    estimatedWaves: number;
}
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
    dataPoints: Array<{
        label: string;
        value: string;
        confidence: string;
    }>;
    recommendedNiche?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    rawContent?: string;
}
export interface StrategyArtifact {
    format: 'structured_json';
    agentType: 'strategist';
    taskId: string;
    executiveSummary: string;
    roadmap: Array<{
        phase: string;
        actions: string[];
        timeline: string;
    }>;
    risks: Array<{
        risk: string;
        mitigation: string;
    }>;
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
    deliverable: Record<string, unknown>;
    gaps: string[];
    nextSteps: NextStep[];
    rawContent?: string;
}
export type TypedArtifact = ResearchArtifact | AnalysisArtifact | StrategyArtifact | ContentArtifact | LeadListArtifact | PipelineArtifact | CodeArtifact | SynthesisArtifact;
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
    content: any;
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
export type ApplicationWindowType = 'lead_engine' | 'research_lab' | 'strategy_board' | 'code_studio' | 'content_engine' | 'learning_workspace' | 'financial_dashboard' | 'time_tracker' | 'invoicing' | 'calendar' | 'general';
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
    source: string;
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
export interface MemoryEntry {
    key: string;
    taskId: string;
    agentType: AgentType;
    data: TypedArtifact;
    writtenAt: number;
    tokensUsed: number;
}
export interface AgentContext {
    entries: MemoryEntry[];
    promptBlock: string;
}
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
export interface ConnectedEvent {
    type: 'connected';
    message: string;
    sessionId: string;
}
export interface PlanReadyEvent {
    type: 'plan_ready';
    parallelCount: number;
    sequentialCount: number;
    waveCount: number;
    nodeCount: number;
    goalType: GoalType;
    successCriteria: string[];
    tasks: {
        parallel: SubTask[];
        sequential: SubTask[];
    };
    estimatedFeeUsd: number;
}
export interface WaveStartEvent {
    type: 'wave_start';
    waveIndex: number;
    taskCount: number;
    taskIds: string[];
}
export interface WaveCompleteEvent {
    type: 'wave_complete';
    waveIndex: number;
    succeeded: number;
    failed: number;
}
export interface RetryWaveEvent {
    type: 'retry_wave';
    retryCount: number;
    taskIds: string[];
}
export interface SynthesisStartEvent {
    type: 'synthesis_start';
    conflictsDetected: number;
}
export interface AgentSpawnEvent {
    type: 'agent_spawn';
    taskId: string;
    taskLabel: string;
    agentType: AgentType;
    agentId?: string;
    mode: TaskMode;
    waveIndex?: number;
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
    outputFormat?: OutputFormat;
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
    workspace?: Workspace;
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
export type NexusSSEEvent = ConnectedEvent | PlanReadyEvent | WaveStartEvent | WaveCompleteEvent | RetryWaveEvent | SynthesisStartEvent | AgentSpawnEvent | AgentWorkingEvent | ArtifactDepositedEvent | HandoffEvent | LedgerUpdateEvent | DoneEvent | ErrorEvent | SystemPauseEvent;
export interface OrchestrateRequest {
    goal: string;
    userId: string;
}
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
    contentUrl?: string;
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
    groqKeyPresent: boolean;
    supabaseConnected: boolean;
    timestamp: string;
}
//# sourceMappingURL=index.d.ts.map