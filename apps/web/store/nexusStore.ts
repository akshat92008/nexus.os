/**
 * Nexus OS — Global State Store (Zustand)
 *
 * Single source of truth for the entire OS workspace. The store is
 * designed around the SSE event stream: every incoming event maps to
 * one or more state mutations here, and the UI components are pure
 * subscribers that re-render reactively.
 *
 * Slice layout:
 *   session   — current orchestration session metadata
 *   agents    — live map of agent cards keyed by taskId
 *   events    — ordered log of all SSE events received
 *   ledger    — running cost & token totals
 *   artifacts — final MCP artifacts (full content) by agentId
 *   ui        — viewport / panel state (sidebar open, active artifact)
 */

'use client';

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { API_BASE, runActionOrchestration } from '../hooks/useNexusSSE';
import {
  AgentType,
  AgentStatus,
  TaskMode,
  Artifact,
  NexusSSEEvent,
  SubTask,
  Workspace,
  WorkspaceTask,
  OngoingMission,
  NextAction,
  ActivityLog,
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

// ── Memory Systems Types (Agentic OS Layer) ─────────────────────────
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
  entityGraph: Record<string, any>; // Placeholder for Knowledge Graph
}

// ── Local Types ────────────────────────────────────────────────────────────

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
  /** Estimated cost if done sequentially (for ROI calculation) */
  sequentialEstimate: number;
}

// NEW — wave execution tracking
export interface WaveState {
  currentWave:  number;
  totalWaves:   number;
  waveStatus:   'idle' | 'running' | 'complete' | 'recovering';
  recoveryCount: number;
}

// NEW — synthesis output (Chief Analyst result)
export interface SynthesisResult {
  available: boolean;
  executiveSummary?: string;
  criteriaResults?: Array<{ criterion: string; result: string; confidence: string; met: boolean }>;
  keyInsights?: Array<{ insight: string; confidence: string }>;
  gaps?: string[];
  nextSteps?: Array<{ action: string; timeframe: string; priority: string }>;
  deliverable?: Record<string, unknown>;
}

// Application Window Types (Multi-App OS)
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


// ── Store Shape ────────────────────────────────────────────────────────────

interface NexusStore {
  // Data
  session:   SessionMeta;
  agents:    Map<string, AgentCard>;
  events:    EventLogEntry[];
  ledger:    LedgerState;
  artifacts: Map<string, Artifact>;
  waves:     WaveState;          // NEW
  synthesis: SynthesisResult;    // NEW
  toasts:    Array<{ id: string; message: string; count: number; timestamp: number }>; // Grouped toast system
  pendingApproval: { taskId: string; taskLabel: string; reason: string } | null;
  execution: {
    isExecuting: boolean;
    currentCommand: string;
    logs: string[];
    taskId: string | null;
  };

  
  // Workspace System (V3)
  workspaces: Record<string, Workspace>;
  activeWorkspaceId: string | null;

  // Time Tracking Actions
  startTimeEntry: (taskId: string, label: string) => void;
  stopTimeEntry: () => void;
  deleteTimeEntry: (id: string) => void;

  // Invoicing Actions
  createInvoice: (invoice: any) => void;
  deleteInvoice: (id: string) => void;
  updateInvoiceStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;

  // Calendar Actions
  addCalendarEvent: (event: any) => void;
  deleteCalendarEvent: (id: string) => void;

  // Multi-App OS (V5)
  appWindows: Record<string, AppWindow>; // open application windows
  schedules:  Record<string, ScheduleConfigUI>; // workspace schedules

  // Continuous Execution System (V4)
  ongoingMissions: Record<string, OngoingMission>;

  // Nexus Ecosystem (V6 Evolution)
  inbox: InboxEntry[];
  installedAgentIds: string[];
  availableAgents: any[]; // List of all agents from the registry
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

  // Financial System (MVP)
  finances: FinancialState;

  // Time Tracking (MVP)
  timeTracking: TimeTrackingState;

  // Invoicing System (MVP)
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

  // Calendar System (MVP)
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

  // Memory Systems (Agentic OS)
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


  // Actions — SSE ingestion
  ingestEvent:    (event: NexusSSEEvent) => void;
  setGoal:        (goal: string) => void;
  setUserId:      (userId: string) => void;
  startSession:   (goal: string, userId: string) => void;
  resetWorkspace: () => void;
  clearHalt:      () => void;
  hydrateFromServer: (userId: string) => Promise<void>;
  persistServerState: () => Promise<void>;

  // Actions — UI
  setCommandBarFocused:  (v: boolean) => void;
  setActiveArtifact:     (id: string | null) => void;
  toggleSidebar:         () => void;
  setExportModalOpen:    (v: boolean) => void;
  addToast:              (message: string) => void;
  removeToast:           (id: string) => void;
  setError:              (v: string | null) => void; // Legacy support


  // Actions — Workspace
  setActiveWorkspace:    (id: string | null) => void;
  updateSectionContent:  (workspaceId: string, sectionId: string, newContent: any) => void;
  toggleTaskStatus:      (workspaceId: string, sectionId: string, taskId: string) => void;
  deleteWorkspace:       (id: string) => void;

  // Actions — Multi-App OS
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
  toggleDashboard: () => void;
    toggleFinancialView: () => void;
    toggleTimeTrackingView: () => void;
    toggleInvoicingView: () => void;
    toggleCalendarView: () => void;
    toggleGraphView: () => void;
    closeAllModals:  () => void;
    approveTask: (approved: boolean) => Promise<void>;


  executeNextAction:       (workspaceId: string, action: NextAction) => Promise<void>;
  completeNextAction:      (workspaceId: string, actionId: string) => void;
  convertMissionToOngoing: (workspaceId: string) => void;

  // Actions — Ecosystem (V6)
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

  // Actions — Execution (V2.6)
  setExecuting: (isExecuting: boolean, taskId?: string, cmd?: string) => void;
  appendExecutionLog: (log: string) => void;
  clearExecutionLogs: () => void;
}

const toWorkspaceRecord = (workspaces: Workspace[]) =>
  Object.fromEntries(workspaces.map((workspace) => [workspace.id, workspace])) as Record<string, Workspace>;

const toWindowRecord = (windows: AppWindowState[]) =>
  Object.fromEntries(windows.map((window) => [window.workspaceId, window])) as Record<string, AppWindow>;

const toScheduleRecord = (schedules: ScheduleSnapshot[]) =>
  Object.fromEntries(schedules.map((schedule) => [schedule.scheduleId, schedule])) as Record<string, ScheduleConfigUI>;

const toMissionRecord = (missions: OngoingMission[]) =>
  Object.fromEntries(missions.map((mission) => [mission.id, mission])) as Record<string, OngoingMission>;

function applyServerSnapshot(set: (partial: Partial<NexusStore>) => void, snapshot: UserStateSnapshot) {
  set({
    workspaces: toWorkspaceRecord(snapshot.workspaces || []),
    activeWorkspaceId: snapshot.activeWorkspaceId || null,
    appWindows: toWindowRecord(snapshot.appWindows || []),
    schedules: toScheduleRecord(snapshot.schedules || []),
    ongoingMissions: toMissionRecord(snapshot.ongoingMissions || []),
    inbox: snapshot.inbox || [],
    installedAgentIds: snapshot.installedAgentIds || [],
    calendar: {
      events: snapshot.calendar?.events || [],
    },
    finances: {
      revenue: snapshot.finances?.revenue ?? 0,
      expenses: snapshot.finances?.expenses ?? 0,
      profit: snapshot.finances?.profit ?? 0,
      cashPosition: snapshot.finances?.cashPosition ?? 0,
      runway: snapshot.finances?.runway ?? 0,
      revenueTrend: snapshot.finances?.revenueTrend || [],
      topRevenueSources: snapshot.finances?.topRevenueSources || [],
      topExpenses: snapshot.finances?.topExpenses || [],
      records: snapshot.finances?.records || [],
    },
    timeTracking: {
      activeEntry: snapshot.timeTracking?.activeEntry ?? null,
      recentEntries: snapshot.timeTracking?.recentEntries || [],
    },
    invoicing: {
      invoices: snapshot.invoicing?.invoices || [],
    },
  });
}

function buildServerSnapshot(state: NexusStore): UserStateSnapshot {
  return {
    userId: state.session.userId,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: Object.values(state.workspaces),
    appWindows: Object.values(state.appWindows),
    schedules: Object.values(state.schedules),
    ongoingMissions: Object.values(state.ongoingMissions),
    inbox: state.inbox,
    installedAgentIds: state.installedAgentIds,
    finances: {
      ...state.finances,
      records: state.finances.records,
    },
    timeTracking: state.timeTracking,
    invoicing: state.invoicing,
    calendar: state.calendar,
    updatedAt: Date.now(),
  };
}

// ── Initial State ──────────────────────────────────────────────────────────

const initialSession: SessionMeta = {
  id:          '',
  goal:        '',
  userId:      '',
  startedAt:   null,
  completedAt: null,
  durationMs:  null,
  status:      'idle',
  systemPauseUntil: null,
  successCriteria: [],
};

const initialLedger: LedgerState = {
  totalFeeUsd:        0,
  totalTokensUsed:    0,
  transactionCount:   0,
  estimatedFeeUsd:    0,
  sequentialEstimate: 0,
};

const initialMemorySystems: MemorySystems = {
  shortTermContext: {
    lastLogin: Date.now(),
    recentDecisions: [],
  },
  preferences: {
    verbosity: 'detailed',
    riskTolerance: 'medium',
    defaultIntegrations: ['email', 'calendar'],
  },
  entityGraph: {},
};

// ── Store ──────────────────────────────────────────────────────────────────

export const useNexusStore = create<NexusStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // ── Initial Data ─────────────────────────────────────────────────────
      session:   initialSession,
      agents:    new Map(),
      events:    [],
      ledger:    initialLedger,
      artifacts: new Map(),
      waves: {
        currentWave: 0,
        totalWaves: 0,
        waveStatus: 'idle',
        recoveryCount: 0,
      },
      synthesis: {
        available: false,
      },
      toasts:    [],
      pendingApproval: null,
      execution: {
        isExecuting: false,
        currentCommand: '',
        logs: [],
        taskId: null,
      },

      addToast: (message) => {
        const { toasts } = get();
        const now = Date.now();
        // Group identical messages within 5 seconds
        const existingIdx = toasts.findIndex(t => t.message === message && (now - t.timestamp < 5000));

        if (existingIdx !== -1) {
          const nextToasts = [...toasts];
          nextToasts[existingIdx] = {
            ...nextToasts[existingIdx],
            count: nextToasts[existingIdx].count + 1,
            timestamp: now
          };
          set({ toasts: nextToasts });
        } else {
          set({ toasts: [...toasts, { id: crypto.randomUUID(), message, count: 1, timestamp: now }] });
        }
      },

      removeToast: (id) => 
        set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),


      // Workspace System
      workspaces: {},
      activeWorkspaceId: null,

      // Multi-App OS (V5)
      appWindows: {},
      schedules:  {},

      // Continuous OS
      ongoingMissions: {},

      // Financial System MVP
      finances: {
        revenue: 125450,
        expenses: 45230,
        profit: 80220,
        cashPosition: 250000,
        runway: 16.7,
        revenueTrend: [45000, 52000, 48000, 61000, 55000, 67000, 72000, 85000, 92000, 105000, 115000, 125450],
        topRevenueSources: [
          { source: 'E-commerce', amount: 85000 },
          { source: 'Services', amount: 30000 },
          { source: 'Consulting', amount: 10450 },
        ],
        topExpenses: [
          { category: 'Salaries', amount: 30000 },
          { category: 'Software', amount: 10000 },
          { category: 'Marketing', amount: 5230 },
        ],
        records: [],
      },

      // Time Tracking MVP
      timeTracking: {
        activeEntry: null,
        recentEntries: [
          {
            id: 'time_1',
            taskId: 'task_1',
            label: 'Market Research for NexusOS',
            durationMs: 3600000 * 2.5, // 2.5 hours
            endTime: Date.now() - 86400000,
            workspaceId: 'ws_1',
          },
          {
            id: 'time_2',
            taskId: 'task_2',
            label: 'Codebase Review & Optimization',
            durationMs: 3600000 * 4.2, // 4.2 hours
            endTime: Date.now() - 172800000,
            workspaceId: 'ws_2',
          },
        ],
      },

      // Invoicing MVP
      invoicing: {
        invoices: [
          {
            id: 'inv_1',
            number: 'INV-2024-001',
            client: 'Acme Corp',
            amount: 12500,
            status: 'paid',
            date: Date.now() - 2592000000, // 30 days ago
            dueDate: Date.now() - 864000000, // 10 days ago
          },
          {
            id: 'inv_2',
            number: 'INV-2024-002',
            client: 'Starlight Ventures',
            amount: 8200,
            status: 'pending',
            date: Date.now() - 1296000000, // 15 days ago
            dueDate: Date.now() + 1296000000, // +15 days
          },
          {
            id: 'inv_3',
            number: 'INV-2024-003',
            client: 'Nebula Systems',
            amount: 4500,
            status: 'overdue',
            date: Date.now() - 3456000000, // 40 days ago
            dueDate: Date.now() - 43200000, // 5 days ago
          },
        ],
      },

      // Calendar MVP
      calendar: {
        events: [
          {
            id: 'evt_1',
            title: 'Strategy Session with Product Team',
            startTime: Date.now() + 3600000 * 2, // In 2 hours
            endTime: Date.now() + 3600000 * 3, // In 3 hours
            location: 'Zoom (https://zoom.us/j/123456789)',
            attendees: ['Sarah Miller', 'John Doe', 'Alice Wong'],
            type: 'meeting',
          },
          {
            id: 'evt_2',
            title: 'Deep Work: Core Engine Optimization',
            startTime: Date.now() + 3600000 * 5, // In 5 hours
            endTime: Date.now() + 3600000 * 8, // In 8 hours
            type: 'task',
          },
          {
            id: 'evt_3',
            title: 'Q1 Performance Review - Prep',
            startTime: Date.now() + 3600000 * 24, // In 24 hours
            endTime: Date.now() + 3600000 * 25, // In 25 hours
            type: 'reminder',
          },
        ],
      },

      // Ecosystem V6
      inbox: [],
      installedAgentIds: ['researcher-standard', 'analyst-standard'], // default pre-installed
      availableAgents: [],
      brainStats: {
        totalMissions: 0,
        activeMissions: 0,
        globalActions: 0,
        opportunities: 0,
        risks: 0,
      },
      globalRisks: [],
      globalOpportunities: [],
      globalActions: [],
      neuralInterrupts: [],
      fsItems: [],
      isFsLoading: false,

      // Memory Systems Base
      memorySystems: initialMemorySystems,

      // ── Initial UI ──────────────────────────────────────────────────────────
    ui: {
      commandBarFocused:  false,
      activeArtifactId:   null,
      sidebarExpanded:    true,
      exportModalOpen:    false,
      appLauncherOpen:    false,
      agentsViewOpen:     false,
      searchViewOpen:     false,
      libraryViewOpen:    false,
      inboxOpen:          false,
      dashboardOpen:      false,
      financialViewOpen:  false,
      timeTrackingViewOpen: false,
      invoicingViewOpen:  false,
      calendarViewOpen:   false,
      graphViewOpen:      false,
    },


    // ── Actions ──────────────────────────────────────────────────────────

    setGoal: (goal) =>
      set((s) => ({ session: { ...s.session, goal } })),

    setUserId: (userId) =>
      set((s) => ({ session: { ...s.session, userId } })),

    startSession: (goal, userId) =>
      set({
        session: {
          ...initialSession,
          id:        crypto.randomUUID(),
          goal,
          userId,
          startedAt: Date.now(),
          status:    'routing',
        },
        agents:    new Map(),
        events:    [],
        ledger:    initialLedger,
        artifacts: new Map(),
        waves: {
          currentWave: 0,
          totalWaves: 0,
          waveStatus: 'idle',
          recoveryCount: 0,
        },
        synthesis: {
          available: false,
        },
        toasts: [],
        ui: {
          ...get().ui,
          sidebarExpanded: true,
        }
      }),


    resetWorkspace: () =>
      set({
        session:   initialSession,
        agents:    new Map(),
        events:    [],
        ledger:    initialLedger,
        artifacts: new Map(),
        toasts: [],
        ui: {
          commandBarFocused: false,
          activeArtifactId:  null,
          sidebarExpanded:   true,
          exportModalOpen:   false,
          appLauncherOpen:   false,
          agentsViewOpen:    false,
          searchViewOpen:    false,
          libraryViewOpen:   false,
          inboxOpen:         false,
          dashboardOpen:     false,
          financialViewOpen:  false,
          timeTrackingViewOpen: false,
          invoicingViewOpen:  false,
          calendarViewOpen:   false,
          graphViewOpen:      false,
        },
      }),

    clearHalt: () =>
      set((s) => ({
        session: { ...s.session, status: 'idle' },
        isRunning: false
      })),

    hydrateFromServer: async (userId) => {
      try {
        const response = await fetch(`${API_BASE}/api/state/${userId}`);
        if (!response.ok) {
          throw new Error(`Failed to hydrate user state (${response.status})`);
        }

        const snapshot = await response.json() as UserStateSnapshot;
        applyServerSnapshot(set, snapshot);
      } catch (err) {
        get().addToast('Failed to load your saved workspace state.');
      }
    },

    persistServerState: async () => {
      const snapshot = buildServerSnapshot(get());
      if (!snapshot.userId) return;

      try {
        const response = await fetch(`${API_BASE}/api/state/${snapshot.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot),
        });

        if (!response.ok) {
          throw new Error(`Failed to persist user state (${response.status})`);
        }
      } catch (err) {
        get().addToast('Failed to save the latest workspace changes.');
      }
    },


    // ── SSE Event Ingestion ───────────────────────────────────────────────

    ingestEvent: (event: NexusSSEEvent) => {
      // Always append to event log
      const entry: EventLogEntry = {
        id:        crypto.randomUUID(),
        type:      event.type,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        raw:       event,
      };

      set((s) => ({ events: [...s.events, entry].slice(-100) }));

      // Dispatch to specific handlers
      switch (event.type) {
        case 'connected': {
          set((s) => ({
            session: {
              ...s.session,
              id: (event as any).sessionId || s.session.id,
              status: 'running',
            },
            pendingApproval: null,
          }));
          break;
        }

        case 'awaiting_approval': {
          set({
            pendingApproval: {
              taskId: (event as any).taskId,
              taskLabel: (event as any).taskLabel,
              reason: (event as any).reason || 'Strategic Checkpoint: Your approval is required to proceed.'
            }
          });
          break;
        }

        case 'system_pause': {
          set((s) => ({
            session: {
              ...s.session,
              status: 'running',
              systemPauseUntil: (event as any).pauseUntil,
            }
          }));
          break;
        }

        case 'plan_ready': {
          // Calculate sequential cost estimate (for ROI widget)
          const allTasks: SubTask[] = [...event.tasks.parallel, ...event.tasks.sequential];
          const sequentialEstimate  = allTasks.length * 0.01 * 1.4; // 40% overhead penalty

          set((s) => ({
            session: { 
              ...s.session, 
              status: 'running',
              goalType: (event as any).goalType,
              successCriteria: (event as any).successCriteria || [],
            },
            waves: {
              ...s.waves,
              totalWaves: (event as any).waveCount || 0,
              waveStatus: 'running'
            },
            ledger: {
              ...s.ledger,
              estimatedFeeUsd:    event.estimatedFeeUsd,
              sequentialEstimate: Math.round(sequentialEstimate * 10000) / 10000,
            },
          }));
          break;
        }

        case 'wave_start': {
          set((s) => ({
            waves: {
              ...s.waves,
              currentWave: (event as any).waveIndex + 1,
              waveStatus: 'running'
            }
          }));
          break;
        }

        case 'wave_complete': {
          set((s) => ({
            waves: {
              ...s.waves,
              waveStatus: (event as any).waveIndex + 1 >= s.waves.totalWaves ? 'complete' : 'running'
            }
          }));
          break;
        }

        case 'retry_wave': {
          set((s) => ({
            waves: {
              ...s.waves,
              waveStatus: 'recovering',
              recoveryCount: (event as any).retryCount
            }
          }));
          break;
        }

        case 'synthesis_start': {
          set((s) => ({
            session: { ...s.session, status: 'synthesizing' },
            waves: { ...s.waves, waveStatus: 'complete' }
          }));
          break;
        }

        case 'agent_spawn': {
          const card: AgentCard = {
            taskId:    event.taskId,
            taskLabel: event.taskLabel,
            agentType: event.agentType,
            mode:      event.mode,
            status:    'spawned',
            spawnedAt: Date.now(),
          };
          set((s) => {
            const next = new Map(s.agents);
            next.set(event.taskId, card);
            return { 
              agents: next,
              session: { ...s.session, systemPauseUntil: null } // Clear pause on activity
            };
          });
          break;
        }

        case 'agent_working': {
          set((s) => {
            const next = new Map(s.agents);
            const card = next.get(event.taskId);
            if (card) {
              next.set(event.taskId, { ...card, status: 'working' });
            } else {
              // Resilience: Create card if spawn was missed
              next.set(event.taskId, {
                taskId: event.taskId,
                taskLabel: event.taskLabel || 'Working...',
                agentType: 'summarizer',
                mode: 'parallel',
                status: 'working',
                spawnedAt: Date.now()
              });
            }
            return { 
              agents: next,
              session: { ...s.session, systemPauseUntil: null } // Clear pause on activity
            };
          });
          break;
        }


        case 'handoff': {
          // Mark all parallel agents as "handoff" state
          set((s) => {
            const next = new Map(s.agents);
            for (const [id, card] of next) {
              if (card.mode === 'parallel' && card.status === 'complete') {
                next.set(id, { ...card, status: 'handoff' });
              }
            }
            return { agents: next };
          });
          break;
        }

        case 'artifact_deposited': {
          const artifact: Artifact = {
            agentId:     event.agentId,
            taskLabel:   event.taskLabel,
            agentType:   event.agentType,
            content:     event.preview, // preview until full fetch
            tokensUsed:  event.tokensUsed,
            depositedAt: event.depositedAt,
          };

          set((s) => {
            const nextAgents    = new Map(s.agents);
            const nextArtifacts = new Map(s.artifacts);
            const card = nextAgents.get(event.agentId);
            if (card) {
              nextAgents.set(event.agentId, { ...card, status: 'complete', artifact });
            }
            nextArtifacts.set(event.agentId, artifact);
            return { agents: nextAgents, artifacts: nextArtifacts };
          });

          // Ecosystem: Add to inbox
          get().addInboxEntry({
            type:     'agent',
            title:    `Artifact: ${event.taskLabel}`,
            content:  `Agent ${event.agentId} (${event.agentType}) has deposited a new artifact.`,
            priority: 'medium'
          });
          break;
        }

        case 'done': {
          set((s) => {
            const nextState: Partial<NexusStore> = {
              session: {
                ...s.session,
                id:          event.sessionId || s.session.id,
                status:      'complete',
                completedAt: Date.now(),
                durationMs:  event.durationMs,
              },
              ledger: {
                ...s.ledger,
                totalFeeUsd:     event.totalFeeUsd,
                totalTokensUsed: event.totalTokensUsed,
              },
            };

            // Workspace V3: Auto-save the generated workspace if present
            if (event.workspace) {
              const nextWorkspaces = { ...s.workspaces, [event.workspace.id]: event.workspace };
              nextState.workspaces = nextWorkspaces;
              nextState.activeWorkspaceId = event.workspace.id;
              nextState.appWindows = {
                ...s.appWindows,
                [event.workspace.id]: {
                  workspaceId: event.workspace.id,
                  windowType: event.workspace.goalType === 'code' ? 'code_studio' : 'general',
                  title: event.workspace.goal,
                  isBackground: false,
                  isPinned: false,
                  openedAt: Date.now(),
                }
              };
            }

            return nextState;
          });

          // Ecosystem: Add to inbox
          get().addInboxEntry({
            type:     'system',
            title:    'Mission Complete',
            content:  `Mission "${get().session.goal}" is ready. ${event.totalAgents} agents utilized.`,
            priority: 'high'
          });
          break;
        }

        case 'error': {
          set((s) => ({
            session: { ...s.session, status: 'error' },
          }));
          get().addToast(event.message || 'An unexpected error occurred');

          // Ecosystem: Add to inbox
          get().addInboxEntry({
            type:     'alert',
            title:    'Mission Error',
            content:  event.message || 'An unexpected error occurred during mission execution.',
            priority: 'critical'
          });
          break;
        }

        case 'sandbox_stdout': {
          get().appendExecutionLog(`[STDOUT] ${event.data}`);
          break;
        }

        case 'sandbox_stderr': {
          get().appendExecutionLog(`[STDERR] ${event.data}`);
          break;
        }

        case 'sandbox_started': {
          get().clearExecutionLogs();
          get().setExecuting(true, event.taskId, event.command);
          break;
        }

        case 'sandbox_finished': {
          get().setExecuting(false);
          break;
        }

      }
    },

    // ── UI Actions ────────────────────────────────────────────────────────

    setCommandBarFocused: (v) =>
      set((s) => ({ ui: { ...s.ui, commandBarFocused: v } })),

    setActiveArtifact: (id) =>
      set((s) => ({ ui: { ...s.ui, activeArtifactId: id } })),

    toggleSidebar: () =>
      set((s) => ({ ui: { ...s.ui, sidebarExpanded: !s.ui.sidebarExpanded } })),

    setExportModalOpen: (v) =>
      set((s) => ({ ui: { ...s.ui, exportModalOpen: v } })),

    setError: (v) => {
      if (v) get().addToast(v);
    },


    // ── Workspace Actions ───────────────────────────────────────────────

    setActiveWorkspace: (id) => {
      set((s) => ({ 
        activeWorkspaceId: id,
        ui: { 
          ...s.ui, 
          dashboardOpen: false,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
        }
      }));
      void get().persistServerState();
    },

    startTimeEntry: (taskId, label) => 
      set((s) => ({
        timeTracking: {
          ...s.timeTracking,
          activeEntry: {
            id: `time_${Date.now()}`,
            taskId,
            label,
            startTime: Date.now(),
          }
        }
      })),

    stopTimeEntry: () =>
      set((s) => {
        if (!s.timeTracking.activeEntry) return {};
        const durationMs = Date.now() - s.timeTracking.activeEntry.startTime;
        const entry = {
          ...s.timeTracking.activeEntry,
          durationMs,
          endTime: Date.now(),
          workspaceId: s.activeWorkspaceId || 'root',
        };
        return {
          timeTracking: {
            activeEntry: null,
            recentEntries: [entry, ...s.timeTracking.recentEntries],
          }
        };
      }),

    deleteTimeEntry: (id) =>
      set((s) => ({
        timeTracking: {
          ...s.timeTracking,
          recentEntries: s.timeTracking.recentEntries.filter(e => e.id !== id),
        }
      })),

    createInvoice: (invoice) => 
      set((s) => ({
        invoicing: {
          ...s.invoicing,
          invoices: [invoice, ...s.invoicing.invoices]
        }
      })),

    deleteInvoice: (id) =>
      set((s) => ({
        invoicing: {
          ...s.invoicing,
          invoices: s.invoicing.invoices.filter(i => i.id !== id)
        }
      })),

    updateInvoiceStatus: (id, status) =>
      set((s) => ({
        invoicing: {
          ...s.invoicing,
          invoices: s.invoicing.invoices.map(i => i.id === id ? { ...i, status } : i)
        }
      })),

    addCalendarEvent: (event) =>
      set((s) => ({
        calendar: {
          ...s.calendar,
          events: [...s.calendar.events, event]
        }
      })),

    deleteCalendarEvent: (id) =>
      set((s) => ({
        calendar: {
          ...s.calendar,
          events: s.calendar.events.filter(e => e.id !== id)
        }
      })),

    deleteWorkspace: (id) => {
      set((s) => {
        const nextWorkspaces = { ...s.workspaces };
        const nextWindows = { ...s.appWindows };
        const nextSchedules = { ...s.schedules };
        const nextMissions = { ...s.ongoingMissions };

        delete nextWorkspaces[id];
        delete nextWindows[id];

        for (const [scheduleId, schedule] of Object.entries(nextSchedules)) {
          if (schedule.workspaceId === id) delete nextSchedules[scheduleId];
        }

        for (const [missionId, mission] of Object.entries(nextMissions)) {
          if (mission.workspaceId === id) delete nextMissions[missionId];
        }

        return {
          workspaces: nextWorkspaces,
          appWindows: nextWindows,
          schedules: nextSchedules,
          ongoingMissions: nextMissions,
          activeWorkspaceId: s.activeWorkspaceId === id ? null : s.activeWorkspaceId,
        };
      });
      void get().persistServerState();
    },

    updateSectionContent: (wsId, secId, content) => {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return {};
        
        const sections = ws.sections.map(sec => 
          sec.id === secId ? { ...sec, content } : sec
        );
        
        return { workspaces: { ...s.workspaces, [wsId]: { ...ws, sections } } };
      });
      void get().persistServerState();
    },

    toggleTaskStatus: (wsId, secId, taskId) => {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return {};
        
        const sections = ws.sections.map(sec => {
          if (sec.id !== secId || sec.type !== 'tasklist') return sec;
          const tasks = (sec.content as WorkspaceTask[]).map(t => 
            t.id === taskId ? { ...t, status: t.status === 'done' ? 'pending' : 'done' as const } : t
          );
          return { ...sec, content: tasks };
        });
        
        return { workspaces: { ...s.workspaces, [wsId]: { ...ws, sections } } };
      });
      void get().persistServerState();
    },

    // ── Multi-App OS Actions ─────────────────────────────────────────────

    createWorkspaceShell: async (type, title) => {
      const goalTypeMap: Record<ApplicationWindowType, GoalType> = {
        lead_engine: 'lead_gen',
        research_lab: 'research',
        strategy_board: 'strategy',
        code_studio: 'code',
        content_engine: 'content',
        learning_workspace: 'research',
        financial_dashboard: 'analysis',
        time_tracker: 'analysis',
        invoicing: 'analysis',
        calendar: 'general',
        general: 'general',
      };

      try {
        const response = await fetch(`${API_BASE}/api/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: get().session.userId,
            title,
            goalType: goalTypeMap[type],
            windowType: type,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create workspace (${response.status})`);
        }

        const payload = await response.json() as { state: UserStateSnapshot };
        applyServerSnapshot(set, payload.state);
        set((s) => ({ ui: { ...s.ui, appLauncherOpen: false } }));
      } catch (err) {
        get().addToast('Unable to create a new workspace.');
      }
    },

    openWindow: (wsId, type, title) => {
      set((s) => ({
        appWindows: {
          ...s.appWindows,
          [wsId]: {
            workspaceId: wsId,
            windowType: type,
            title,
            isBackground: false,
            isPinned: false,
            openedAt: Date.now(),
          }
        },
        activeWorkspaceId: wsId,
      }));
      void get().persistServerState();
    },

    closeWindow: (wsId) => {
      set((s) => {
        const next = { ...s.appWindows };
        delete next[wsId];
        return { 
          appWindows: next,
          activeWorkspaceId: s.activeWorkspaceId === wsId ? null : s.activeWorkspaceId
        };
      });
      void get().persistServerState();
    },

    setWindowBackground: (wsId, isBg) => {
      set((s) => {
        const win = s.appWindows[wsId];
        if (!win) return {};
        return { appWindows: { ...s.appWindows, [wsId]: { ...win, isBackground: isBg } } };
      });
      void get().persistServerState();
    },

    pinWindow: (wsId, isPinned) => {
      set((s) => {
        const win = s.appWindows[wsId];
        if (!win) return {};
        return { appWindows: { ...s.appWindows, [wsId]: { ...win, isPinned } } };
      });
      void get().persistServerState();
    },

    upsertSchedule: (config) => {
      set((s) => ({
        schedules: { ...s.schedules, [config.scheduleId]: config }
      }));
      void get().persistServerState();
    },

    removeSchedule: (scheduleId) => {
      set((s) => {
        const next = { ...s.schedules };
        delete next[scheduleId];
        return { schedules: next };
      });
      void get().persistServerState();
    },

    setAppLauncherOpen: (v) =>
      set((s) => ({ ui: { ...s.ui, appLauncherOpen: v } })),

    toggleAppLauncher: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          appLauncherOpen: !s.ui.appLauncherOpen,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
        }
      })),

    toggleAgentsView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          agentsViewOpen: !s.ui.agentsViewOpen,
          appLauncherOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
        }
      })),

    toggleSearchView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          searchViewOpen: !s.ui.searchViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          libraryViewOpen: false,
        }
      })),

    toggleLibraryView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          libraryViewOpen: !s.ui.libraryViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          inboxOpen: false,
        }
      })),

    toggleInbox: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          inboxOpen: !s.ui.inboxOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
        }
      })),

    toggleDashboard: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          dashboardOpen: !s.ui.dashboardOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
        }
      })),

    toggleFinancialView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          financialViewOpen: !s.ui.financialViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          timeTrackingViewOpen: false,
          invoicingViewOpen: false,
          calendarViewOpen: false,
        }
      })),

    toggleTimeTrackingView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          timeTrackingViewOpen: !s.ui.timeTrackingViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          financialViewOpen: false,
          invoicingViewOpen: false,
          calendarViewOpen: false,
        }
      })),

    toggleInvoicingView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          invoicingViewOpen: !s.ui.invoicingViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          financialViewOpen: false,
          timeTrackingViewOpen: false,
          calendarViewOpen: false,
        }
      })),

    toggleCalendarView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          calendarViewOpen: !s.ui.calendarViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          financialViewOpen: false,
          timeTrackingViewOpen: false,
          invoicingViewOpen: false,
          graphViewOpen: false,
        }
      })),

    toggleGraphView: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          graphViewOpen: !s.ui.graphViewOpen,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          financialViewOpen: false,
          timeTrackingViewOpen: false,
          invoicingViewOpen: false,
          calendarViewOpen: false,
        }
      })),

    closeAllModals: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          appLauncherOpen: false,
          agentsViewOpen: false,
          searchViewOpen: false,
          libraryViewOpen: false,
          inboxOpen: false,
          dashboardOpen: false,
          financialViewOpen: false,
          timeTrackingViewOpen: false,
          invoicingViewOpen: false,
          calendarViewOpen: false,
          graphViewOpen: false,
        }
      })),

    approveTask: async (approved: boolean) => {
      const { session, pendingApproval } = get();
      if (!pendingApproval) return;

      try {
        const res = await fetch(`${API_BASE}/api/approve-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            taskId: pendingApproval.taskId,
            approved
          }),
        });

        if (!res.ok) throw new Error('Failed to send approval signal');
        
        set({ pendingApproval: null });
      } catch (err) {
        get().addToast((err as Error).message);
      }
    },


    // ── Continuous OS Actions ─────────────────────────────────────────────

    completeNextAction: (wsId: string, actionId: string) => {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws || !ws.nextActions) return {};

        const action = ws.nextActions.find(a => a.id === actionId);
        if (!action) return {};

        const nextActions = ws.nextActions.filter(a => a.id !== actionId);
        
        const logEntry: ActivityLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          type: 'user_action',
          message: `Completed action: ${action.title}`
        };
        const activityLog = [logEntry, ...(ws.activityLog || [])];

        return { workspaces: { ...s.workspaces, [wsId]: { ...ws, nextActions, activityLog } } };
      });
      void get().persistServerState();
    },

    executeNextAction: async (wsId, action) => {
      const userId = get().session.userId;
      
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return {};
        const logEntry: ActivityLog = {
          id: `log_${Date.now()}_exec`,
          timestamp: Date.now(),
          type: 'execution',
          message: `Attempting execution: ${action.title}`
        };
        const activityLog = [logEntry, ...(ws.activityLog || [])];
        return { workspaces: { ...s.workspaces, [wsId]: { ...ws, activityLog } } };
      });

      try {
        await runActionOrchestration(action.id, wsId, userId, get().ingestEvent);
      } catch (err) {
        get().addToast(err instanceof Error ? err.message : 'Action execution failed');
      }
    },

    convertMissionToOngoing: (wsId) => {
      set((s) => {
        const ws = s.workspaces[wsId];
        if (!ws) return {};

        const mission: OngoingMission = {
          id: `om_${crypto.randomUUID()}`,
          goal: ws.goal,
          status: 'active',
          lastRun: Date.now(),
          nextRun: Date.now() + 86400000, // +24 hours
          workspaceId: wsId,
        };

        const logEntry: ActivityLog = {
          id: `log_${Date.now()}_om`,
          timestamp: Date.now(),
          type: 'update',
          message: `Mission converted to Ongoing (Daily execution enabled).`
        };
        const activityLog = [logEntry, ...(ws.activityLog || [])];

        return { 
          ongoingMissions: { ...s.ongoingMissions, [mission.id]: mission },
          workspaces: { ...s.workspaces, [wsId]: { ...ws, activityLog } }
        };
      });
      void get().persistServerState();
    },


    // ── Ecosystem V6 Actions ────────────────────────────────────────────────

    addInboxEntry: (entry) => {
      set((s) => ({
        inbox: [
          {
            ...entry,
            id: crypto.randomUUID(),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            read: false,
          },
          ...s.inbox,
        ].slice(0, 50), // keep last 50
      }));
      void get().persistServerState();
    },

    markInboxRead: (id) => {
      set((s) => ({
        inbox: s.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)),
      }));
      void get().persistServerState();
    },

    clearInbox: () => {
      set({ inbox: [] });
      void get().persistServerState();
    },

    fetchAvailableAgents: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/agents`);
        const { agents } = await res.json();
        set({ availableAgents: agents });
      } catch (err) {
        get().addToast('Failed to fetch available agents.');
      }
    },

    fetchBrainStats: async () => {
      try {
        const res = await fetch(`${API_BASE}/api/brain/stats`);
        const stats = await res.json();
        
        const intelRes = await fetch(`${API_BASE}/api/brain/intelligence`);
        const { opportunities, risks, actions } = await intelRes.json();

        const interruptRes = await fetch(`${API_BASE}/api/brain/interrupts`);
        const { interrupts } = await interruptRes.json();

        set({ 
          brainStats: stats,
          globalOpportunities: opportunities,
          globalRisks: risks,
          globalActions: actions,
          neuralInterrupts: interrupts
        });
      } catch (err) {
        // Silently fail for stats
      }
    },
    
    clearInterrupt: async (id: string) => {
      try {
        await fetch(`${API_BASE}/api/brain/interrupts/${id}/clear`, { method: 'POST' });
        set((s) => ({
          neuralInterrupts: s.neuralInterrupts.filter(i => i.id !== id)
        }));
      } catch (err) {
        get().addToast('Failed to clear interrupt.');
      }
    },

    installAgent: (id) => {
      set((s) => ({
        installedAgentIds: Array.from(new Set([...s.installedAgentIds, id])),
      }));
      void fetch(`${API_BASE}/api/agents/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: get().session.userId, agentId: id }),
      }).catch(() => {
        get().addToast('Failed to persist installed agent state.');
      });
    },

    spawnAgent: async (agentType) => {
      const { session, activeWorkspaceId, workspaces } = get();
      const workspace = activeWorkspaceId ? workspaces[activeWorkspaceId] : null;
      
      try {
        const res = await fetch(`${API_BASE}/api/agents/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentType,
            goal: workspace?.goal || session.goal || 'Autonomous Research',
            userId: session.userId,
            workspaceId: activeWorkspaceId || 'global',
          }),
        });

        if (res.ok) {
          get().addToast(`Unit deployed: ${agentType.toUpperCase()}`);
        } else {
          throw new Error('Spawn failed');
        }
      } catch (err) {
        get().addToast(`Failed to deploy ${agentType} unit.`);
      }
    },

    fetchFsItems: async (parentId = 'root') => {
      set({ isFsLoading: true });
      try {
        const res = await fetch(`${API_BASE}/api/fs/list?parentId=${parentId}`);
        const { files, folders } = await res.json();
        set({ fsItems: [...folders, ...files], isFsLoading: false });
      } catch (err) {
        get().addToast('Failed to fetch files from NexusFS');
        set({ isFsLoading: false });
      }
    },

    uploadFsFile: async (name, content, parentId = 'root') => {
      try {
        const res = await fetch(`${API_BASE}/api/fs/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, content, parentId, userId: get().session.userId }),
        });
        if (res.ok) await get().fetchFsItems(parentId);
      } catch (err) {
        get().addToast('File upload failed');
      }
    },

    searchFs: async (query) => {
      if (!query) {
        await get().fetchFsItems();
        return;
      }
      set({ isFsLoading: true });
      try {
        const res = await fetch(`${API_BASE}/api/fs/search?q=${encodeURIComponent(query)}`);
        const { results } = await res.json();
        set({ fsItems: results, isFsLoading: false });
      } catch (err) {
        set({ isFsLoading: false });
      }
    },

    // ── Execution Actions (V2.6) ──────────────────────────────────────────
    setExecuting: (isExecuting, taskId, cmd) =>
      set((s) => ({
        execution: {
          ...s.execution,
          isExecuting,
          taskId: taskId || null,
          currentCommand: cmd || s.execution.currentCommand,
        }
      })),

    appendExecutionLog: (log) =>
      set((s) => ({
        execution: {
          ...s.execution,
          logs: [...s.execution.logs, log].slice(-500)
        }
      })),

    clearExecutionLogs: () =>
      set((s) => ({
        execution: {
          ...s.execution,
          logs: []
        }
      })),
  })),
  {
    name: 'nexus-workspace-storage',
    partialize: (state) => ({ 
      session: state.session,
      workspaces: state.workspaces,
      ongoingMissions: state.ongoingMissions,
      memorySystems: state.memorySystems,
      appWindows: state.appWindows,
      schedules: state.schedules,
      inbox: state.inbox,
      installedAgentIds: state.installedAgentIds,
    }),
  }
));

// ── Derived Selectors (memoized outside the store) ─────────────────────────

export const selectParallelAgents = (s: NexusStore) =>
  Array.from(s.agents.values()).filter((a) => a.mode === 'parallel');

export const selectSequentialAgents = (s: NexusStore) =>
  Array.from(s.agents.values()).filter((a) => a.mode === 'sequential');

export const selectIsRunning = (s: NexusStore) =>
  s.session.status === 'routing' || s.session.status === 'running';

export const selectRoiSavings = (s: NexusStore) =>
  Math.max(0, s.ledger.sequentialEstimate - s.ledger.totalFeeUsd);
