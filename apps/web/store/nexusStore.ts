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
import type {
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
  error:     string | null; // Global error tracking

  
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
  fsItems: (NexusFile | NexusFolder)[];
  isFsLoading: boolean;

  // Financial System (MVP)
  finances: {
    revenue: number;
    expenses: number;
    profit: number;
    cashPosition: number;
    runway: number;
    revenueTrend: number[];
    topRevenueSources: { source: string; amount: number }[];
    topExpenses: { category: string; amount: number }[];
  };

  // Time Tracking (MVP)
  timeTracking: {
    activeEntry: {
      id: string;
      taskId: string;
      startTime: number;
      label: string;
    } | null;
    recentEntries: {
      id: string;
      taskId: string;
      label: string;
      durationMs: number;
      endTime: number;
      workspaceId: string;
    }[];
  };

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
  };


  // Actions — SSE ingestion
  ingestEvent:    (event: NexusSSEEvent) => void;
  setGoal:        (goal: string) => void;
  setUserId:      (userId: string) => void;
  startSession:   (goal: string, userId: string) => void;
  resetWorkspace: () => void;
  hydrateFromServer: (userId: string) => Promise<void>;
  persistServerState: () => Promise<void>;

  // Actions — UI
  setCommandBarFocused:  (v: boolean) => void;
  setActiveArtifact:     (id: string | null) => void;
  toggleSidebar:         () => void;
  setExportModalOpen:    (v: boolean) => void;
  setError:               (v: string | null) => void;


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
    closeAllModals:  () => void;


  executeNextAction:       (workspaceId: string, action: NextAction) => Promise<void>;
  completeNextAction:      (workspaceId: string, actionId: string) => void;
  convertMissionToOngoing: (workspaceId: string) => void;

  // Actions — Ecosystem (V6)
  addInboxEntry:        (entry: Omit<InboxEntry, 'id' | 'timestamp' | 'read'>) => void;
  markInboxRead:         (id: string) => void;
  clearInbox:            () => void;
  installAgent:          (id: string) => void;
  fetchFsItems:          (parentId?: string) => Promise<void>;
  uploadFsFile:          (name: string, content: string, parentId?: string) => Promise<void>;
  searchFs:              (query: string) => Promise<void>;
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
    workspaces: toWorkspaceRecord(snapshot.workspaces),
    activeWorkspaceId: snapshot.activeWorkspaceId,
    appWindows: toWindowRecord(snapshot.appWindows),
    schedules: toScheduleRecord(snapshot.schedules),
    ongoingMissions: toMissionRecord(snapshot.ongoingMissions),
    inbox: snapshot.inbox,
    installedAgentIds: snapshot.installedAgentIds,
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
      error:     null,


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
        error: null,
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
        },
      }),

    hydrateFromServer: async (userId) => {
      try {
        const response = await fetch(`${API_BASE}/api/state/${userId}`);
        if (!response.ok) {
          throw new Error(`Failed to hydrate user state (${response.status})`);
        }

        const snapshot = await response.json() as UserStateSnapshot;
        applyServerSnapshot(set, snapshot);
      } catch (err) {
        set({ error: 'Failed to load your saved workspace state.' });
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
        set({ error: 'Failed to save the latest workspace changes.' });
      }
    },


    // ── SSE Event Ingestion ───────────────────────────────────────────────

    ingestEvent: (event: NexusSSEEvent) => {
      // Always append to event log
      const entry: EventLogEntry = {
        id:        crypto.randomUUID(),
        type:      event.type,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        raw:       event,
      };

      set((s) => ({ events: [...s.events, entry] }));

      // Dispatch to specific handlers
      switch (event.type) {
        case 'connected': {
          set((s) => ({
            session: {
              ...s.session,
              id: (event as any).sessionId || s.session.id,
              status: 'running',
            }
          }));
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
            error: event.message || 'An unexpected error occurred',
          }));

          // Ecosystem: Add to inbox
          get().addInboxEntry({
            type:     'alert',
            title:    'Mission Error',
            content:  event.message || 'An unexpected error occurred during mission execution.',
            priority: 'critical'
          });
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

    setError: (v) => set({ error: v }),


    // ── Workspace Actions ───────────────────────────────────────────────

    setActiveWorkspace: (id) => {
      set({ activeWorkspaceId: id });
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
        set({ error: 'Unable to create a new workspace.' });
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
        }
      })),


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
        set({ error: err instanceof Error ? err.message : 'Action execution failed' });
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

    installAgent: (id) => {
      set((s) => ({
        installedAgentIds: Array.from(new Set([...s.installedAgentIds, id])),
      }));
      void fetch(`${API_BASE}/api/agents/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: get().session.userId, agentId: id }),
      }).catch(() => {
        set({ error: 'Failed to persist installed agent state.' });
      });
    },

    fetchFsItems: async (parentId = 'root') => {
      set({ isFsLoading: true });
      try {
        const res = await fetch(`${API_BASE}/api/fs/list?parentId=${parentId}`);
        const { files, folders } = await res.json();
        set({ fsItems: [...folders, ...files], isFsLoading: false });
      } catch (err) {
        set({ error: 'Failed to fetch files from NexusFS', isFsLoading: false });
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
        set({ error: 'File upload failed' });
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
