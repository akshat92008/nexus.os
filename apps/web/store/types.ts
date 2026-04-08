import {
  AgentType,
  AgentStatus,
  TaskMode,
  Artifact,
  NexusSSEEvent,
  Workspace,
  OngoingMission,
  NextAction,
  NexusFile,
  NexusFolder,
  GoalType,
  AppWindowState,
  NexusInboxEntry,
  ScheduleSnapshot,
  UserStateSnapshot,
  FinancialState,
  TimeTrackingState,
} from '@nexus-os/types';

export type InboxEntry = NexusInboxEntry;

export interface MemorySystems {
  shortTermContext: {
    lastLogin: number;
    recentDecisions: string[];
  };
  preferences: {
    verbosity: 'concise' | 'detailed';
    riskTolerance: 'low' | 'medium' | 'high';
    defaultIntegrations: string[];
  };
  entityGraph: Record<string, any>;
}

export interface AgentCard {
  taskId:    string;
  taskLabel: string;
  agentType: AgentType;
  mode:      TaskMode;
  status:    AgentStatus;
  artifact?: Artifact;
  spawnedAt: number;
}

export interface EventLogEntry {
  id:        string;
  type:      NexusSSEEvent['type'];
  timestamp: string;
  raw:       NexusSSEEvent;
}

export interface SessionMeta {
  id:         string;
  goal:       string;
  userId:     string;
  startedAt:  number | null;
  completedAt: number | null;
  durationMs: number | null;
  status: 'idle' | 'routing' | 'running' | 'synthesizing' | 'complete' | 'error';
  systemPauseUntil: number | null;
  goalType?:   GoalType;
  successCriteria: string[];
}

export interface LedgerState {
  totalFeeUsd:      number;
  totalTokensUsed:  number;
  transactionCount: number;
  estimatedFeeUsd:  number;
  sequentialEstimate: number;
}

export interface WaveState {
  currentWave:  number;
  totalWaves:   number;
  waveStatus:   'idle' | 'running' | 'complete' | 'recovering';
  recoveryCount: number;
}

export interface SynthesisResult {
  available: boolean;
  executiveSummary?: string;
  criteriaResults?: Array<{ criterion: string; result: string; confidence: string; met: boolean }>;
  keyInsights?: Array<{ insight: string; confidence: string }>;
  gaps?: string[];
  nextSteps?: Array<{ action: string; timeframe: string; priority: string }>;
  deliverable?: Record<string, unknown>;
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

export interface AppWindow extends AppWindowState {}

export interface ScheduleConfigUI extends ScheduleSnapshot {}

export interface NexusStore {
  // Data
  session:   SessionMeta;
  agents:    Map<string, AgentCard>;
  events:    EventLogEntry[];
  ledger:    LedgerState;
  artifacts: Map<string, Artifact>;
  waves:     WaveState;
  synthesis: SynthesisResult;
  toasts:    Array<{ id: string; message: string; count: number; timestamp: number }>;
  pendingApproval: { taskId: string; taskLabel: string; reason: string } | null;
  execution: {
    isExecuting: boolean;
    currentCommand: string;
    logs: string[];
    taskId: string | null;
  };
  
  // Workspace System
  workspaces: Record<string, Workspace>;
  activeWorkspaceId: string | null;

  // Multi-App OS
  appWindows: Record<string, AppWindow>;
  schedules:  Record<string, ScheduleConfigUI>;

  // Continuous OS
  ongoingMissions: Record<string, OngoingMission>;

  // Ecosystem
  inbox: InboxEntry[];
  installedAgentIds: string[];
  availableAgents: any[];
  brainStats: {
    totalMissions: number;
    activeMissions: number;
    globalActions: number;
    opportunities: number;
    risks: number;
  };
  globalRisks: any[];
  globalOpportunities: any[];
  globalActions: any[];
  neuralInterrupts: any[];
  fsItems: (NexusFile | NexusFolder)[];
  isFsLoading: boolean;

  // Financial & Time Systems
  finances: FinancialState;
  timeTracking: TimeTrackingState;
  invoicing: {
    invoices: {
      id: string;
      number: string;
      client: string;
      amount: number;
      status: 'paid' | 'pending' | 'overdue';
      date: number;
      dueDate: number;
    }[];
  };
  calendar: {
    events: {
      id: string;
      title: string;
      startTime: number;
      endTime: number;
      location?: string;
      attendees?: string[];
      type: 'meeting' | 'task' | 'reminder';
    }[];
  };

  // Memory Systems
  memorySystems: MemorySystems;

  // UI
  ui: {
    commandBarFocused:  boolean;
    activeArtifactId:   string | null;
    sidebarExpanded:    boolean;
    exportModalOpen:    boolean;
    appLauncherOpen:    boolean;
    agentsViewOpen:     boolean;
    searchViewOpen:     boolean;
    libraryViewOpen:    boolean;
    inboxOpen:          boolean;
    dashboardOpen:      boolean;
    financialViewOpen:  boolean;
    timeTrackingViewOpen: boolean;
    invoicingViewOpen:  boolean;
    calendarViewOpen:   boolean;
    graphViewOpen:      boolean;
  };

  // Actions
  ingestEvent:    (event: NexusSSEEvent) => void;
  setGoal:        (goal: string) => void;
  setUserId:      (userId: string) => void;
  startSession:   (goal: string, userId: string) => void;
  resetWorkspace: () => void;
  clearHalt:      () => void;
  hydrateFromServer: (userId: string) => Promise<void>;
  persistServerState: () => Promise<void>;

  setCommandBarFocused:  (v: boolean) => void;
  setActiveArtifact:     (id: string | null) => void;
  toggleSidebar:         () => void;
  setExportModalOpen:    (v: boolean) => void;
  addToast:              (message: string) => void;
  removeToast:           (id: string) => void;
  setError:              (v: string | null) => void;

  setActiveWorkspace:    (id: string | null) => void;
  updateSectionContent:  (workspaceId: string, sectionId: string, newContent: any) => void;
  toggleTaskStatus:      (workspaceId: string, sectionId: string, taskId: string) => void;
  deleteWorkspace:       (id: string) => void;

  createWorkspaceShell:  (type: ApplicationWindowType, title: string) => Promise<void>;
  openWindow:            (workspaceId: string, type: ApplicationWindowType, title: string) => void;
  closeWindow:           (workspaceId: string) => void;
  setWindowBackground:   (workspaceId: string, isBackground: boolean) => void;
  pinWindow:             (workspaceId: string, isPinned: boolean) => void;
  upsertSchedule:        (config: ScheduleConfigUI) => void;
  removeSchedule:        (scheduleId: string) => void;
  
  setAppLauncherOpen:    (v: boolean) => void;
  toggleAppLauncher:     () => void;
  toggleAgentsView:      () => void;
  toggleSearchView:      () => void;
  toggleLibraryView:     () => void;
  toggleInbox:           () => void;
  toggleDashboard:       () => void;
  toggleFinancialView:   () => void;
  toggleTimeTrackingView:() => void;
  toggleInvoicingView:   () => void;
  toggleCalendarView:    () => void;
  toggleGraphView:       () => void;
  closeAllModals:        () => void;
  approveTask:           (approved: boolean) => Promise<void>;

  executeNextAction:       (workspaceId: string, action: NextAction) => Promise<void>;
  completeNextAction:      (workspaceId: string, actionId: string) => void;
  convertMissionToOngoing: (workspaceId: string) => void;

  addInboxEntry:        (entry: Omit<InboxEntry, 'id' | 'timestamp' | 'read'>) => void;
  markInboxRead:         (id: string) => void;
  clearInbox:            () => void;
  fetchAvailableAgents:  () => Promise<void>;
  fetchBrainStats:       () => Promise<void>;
  clearInterrupt:        (id: string) => Promise<void>;
  installAgent:          (id: string) => void;
  spawnAgent:            (agentType: AgentType) => Promise<void>;
  fetchFsItems:          (parentId?: string) => Promise<void>;
  uploadFsFile:          (name: string, content: string, parentId?: string) => Promise<void>;
  searchFs:              (query: string) => Promise<void>;

  startTimeEntry:  (taskId: string, label: string) => void;
  stopTimeEntry:   () => void;
  deleteTimeEntry: (id: string) => void;
  createInvoice:   (invoice: any) => void;
  deleteInvoice:   (id: string) => void;
  updateInvoiceStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;
  addCalendarEvent: (event: any) => void;
  deleteCalendarEvent: (id: string) => void;

  setExecuting: (isExecuting: boolean, taskId?: string, cmd?: string) => void;
  appendExecutionLog: (log: string) => void;
  clearExecutionLogs: () => void;
}
