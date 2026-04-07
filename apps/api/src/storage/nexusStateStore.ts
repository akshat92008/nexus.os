import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AppWindowState,
  NexusInboxEntry,
  OngoingMission,
  ScheduleSnapshot,
  UserStateSnapshot,
  Workspace,
  WorkspaceSection,
} from '@nexus-os/types';

interface DatabaseShape {
  version: number;
  users: Record<string, UserStateSnapshot>;
}

const DEFAULT_AGENT_IDS = ['researcher-standard', 'analyst-standard'];
const DB_FILE = fileURLToPath(new URL('../../data/nexus-state.json', import.meta.url));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createDefaultUserState(userId: string): UserStateSnapshot {
  return {
    userId,
    activeWorkspaceId: null,
    workspaces: [],
    appWindows: [],
    schedules: [],
    ongoingMissions: [],
    inbox: [],
    installedAgentIds: ['researcher-standard', 'analyst-standard'],
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
        { source: 'Salaries', amount: 30000 },
        { source: 'Software', amount: 10000 },
        { source: 'Marketing', amount: 5230 },
      ],
      records: [],
    },
    timeTracking: {
      activeEntry: null,
      recentEntries: [
        {
          id: 'time_1',
          taskId: 'task_1',
          label: 'Market Research for NexusOS',
          durationMs: 3600000 * 2.5,
          endTime: Date.now() - 86400000,
          workspaceId: 'ws_1',
        },
        {
          id: 'time_2',
          taskId: 'task_2',
          label: 'Codebase Review & Optimization',
          durationMs: 3600000 * 4.2,
          endTime: Date.now() - 172800000,
          workspaceId: 'ws_2',
        },
      ],
    },
    invoicing: {
      invoices: [
        {
          id: 'inv_1',
          number: 'INV-2024-001',
          client: 'Acme Corp',
          amount: 12500,
          status: 'paid',
          date: Date.now() - 2592000000,
          dueDate: Date.now() - 864000000,
        },
        {
          id: 'inv_2',
          number: 'INV-2024-002',
          client: 'Starlight Ventures',
          amount: 8200,
          status: 'pending',
          date: Date.now() - 1296000000,
          dueDate: Date.now() + 1296000000,
        },
        {
          id: 'inv_3',
          number: 'INV-2024-003',
          client: 'Nebula Systems',
          amount: 4500,
          status: 'overdue',
          date: Date.now() - 3456000000,
          dueDate: Date.now() - 432000000,
        },
      ],
    },
    calendar: {
      events: [
        {
          id: 'evt_1',
          title: 'Strategy Session with Product Team',
          startTime: Date.now() + 3600000 * 2,
          endTime: Date.now() + 3600000 * 3,
          location: 'Zoom (https://zoom.us/j/123456789)',
          attendees: ['Sarah Miller', 'John Doe', 'Alice Wong'],
          type: 'meeting',
        },
        {
          id: 'evt_2',
          title: 'Deep Work: Core Engine Optimization',
          startTime: Date.now() + 3600000 * 5,
          endTime: Date.now() + 3600000 * 8,
          type: 'task',
        },
        {
          id: 'evt_3',
          title: 'Q1 Performance Review - Prep',
          startTime: Date.now() + 3600000 * 24,
          endTime: Date.now() + 3600000 * 25,
          type: 'reminder',
        },
      ],
    },
    updatedAt: Date.now(),
  };
}

function ensureWorkspaceDefaults(workspace: Workspace): Workspace {
  return {
    ...workspace,
    nextActions: workspace.nextActions ?? [],
    activityLog: workspace.activityLog ?? [],
    metadata: workspace.metadata ?? {},
  };
}

function defaultSectionsForWindow(windowType: AppWindowState['windowType']): WorkspaceSection[] {
  switch (windowType) {
    case 'lead_engine':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'table',
          title: 'Lead Pipeline',
          description: 'Qualified leads and outreach planning.',
          content: [],
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Pipeline Tasks',
          description: 'Actions to enrich, qualify, and contact leads.',
          content: [],
        },
      ];
    case 'research_lab':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'document',
          title: 'Research Brief',
          description: 'Centralized notes, sources, and findings.',
          content: '',
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'insight',
          title: 'Key Findings',
          description: 'High-signal observations and hypotheses.',
          content: [],
        },
      ];
    case 'strategy_board':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'insight',
          title: 'Strategic Insights',
          description: 'Risks, opportunities, and strategic decisions.',
          content: [],
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Execution Roadmap',
          description: 'Priority tasks to move the strategy forward.',
          content: [],
        },
      ];
    case 'code_studio':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'document',
          title: 'Implementation Notes',
          description: 'Architecture, constraints, and engineering context.',
          content: '',
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Engineering Tasks',
          description: 'Changes, bugs, and verification work.',
          content: [],
        },
      ];
    case 'content_engine':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'document',
          title: 'Draft Workspace',
          description: 'Working draft for copy and long-form content.',
          content: '',
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Publishing Checklist',
          description: 'Review, edit, and publishing tasks.',
          content: [],
        },
      ];
    case 'learning_workspace':
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'document',
          title: 'Study Notes',
          description: 'Core concepts and explanations.',
          content: '',
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Revision Tasks',
          description: 'Exercises, questions, and revision actions.',
          content: [],
        },
      ];
    case 'general':
    default:
      return [
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'document',
          title: 'Workspace Notes',
          description: 'General-purpose planning and context capture.',
          content: '',
        },
        {
          id: `sec_${crypto.randomUUID()}`,
          type: 'tasklist',
          title: 'Open Tasks',
          description: 'Next actions and execution checklist.',
          content: [],
        },
      ];
  }
}

export function createWorkspaceShell(params: {
  title: string;
  goalType: Workspace['goalType'];
  windowType: AppWindowState['windowType'];
}): Workspace {
  return ensureWorkspaceDefaults({
    id: crypto.randomUUID(),
    goal: params.title,
    goalType: params.goalType,
    sections: defaultSectionsForWindow(params.windowType),
    createdAt: Date.now(),
    metadata: {
      windowType: params.windowType,
      isShell: true,
    },
  });
}

class NexusStateStore {
  private db: DatabaseShape = { version: 1, users: {} };
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  private async ensureLoaded() {
    if (this.loaded) return;

    try {
      const raw = await readFile(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
      this.db = {
        version: parsed.version ?? 1,
        users: parsed.users ?? {},
      };
    } catch {
      this.db = { version: 1, users: {} };
    }

    this.loaded = true;
  }

  private async flush() {
    await mkdir(dirname(DB_FILE), { recursive: true });
    await writeFile(DB_FILE, JSON.stringify(this.db, null, 2), 'utf8');
  }

  private async mutate<T>(mutator: () => T | Promise<T>): Promise<T> {
    await this.ensureLoaded();

    let result!: T;
    this.writeQueue = this.writeQueue.then(async () => {
      result = await mutator();
      await this.flush();
    });

    await this.writeQueue;
    return result;
  }

  private getUserRef(userId: string): UserStateSnapshot {
    if (!this.db.users[userId]) {
      this.db.users[userId] = createDefaultUserState(userId);
      return this.db.users[userId];
    }

    const current = this.db.users[userId];
    this.db.users[userId] = {
      ...createDefaultUserState(userId),
      ...current,
      workspaces: (current.workspaces ?? []).map(ensureWorkspaceDefaults),
      appWindows: current.appWindows ?? [],
      schedules: current.schedules ?? [],
      ongoingMissions: current.ongoingMissions ?? [],
      inbox: current.inbox ?? [],
      installedAgentIds: Array.from(new Set(current.installedAgentIds ?? DEFAULT_AGENT_IDS)),
      updatedAt: current.updatedAt ?? Date.now(),
    };

    return this.db.users[userId];
  }

  async getUserState(userId: string): Promise<UserStateSnapshot> {
    await this.ensureLoaded();
    return clone(this.getUserRef(userId));
  }

  async syncUserState(userId: string, patch: Partial<UserStateSnapshot>): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);

      state.activeWorkspaceId = patch.activeWorkspaceId ?? state.activeWorkspaceId;
      state.workspaces = (patch.workspaces ?? state.workspaces).map(ensureWorkspaceDefaults);
      state.appWindows = patch.appWindows ?? state.appWindows;
      state.schedules = patch.schedules ?? state.schedules;
      state.ongoingMissions = patch.ongoingMissions ?? state.ongoingMissions;
      state.inbox = patch.inbox ?? state.inbox;
      state.installedAgentIds = Array.from(new Set(patch.installedAgentIds ?? state.installedAgentIds));
      state.updatedAt = Date.now();

      return clone(state);
    });
  }

  async upsertWorkspace(userId: string, workspace: Workspace): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      const nextWorkspace = ensureWorkspaceDefaults(workspace);
      const existingIndex = state.workspaces.findIndex((candidate) => candidate.id === workspace.id);

      if (existingIndex >= 0) {
        state.workspaces[existingIndex] = nextWorkspace;
      } else {
        state.workspaces.unshift(nextWorkspace);
      }

      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async createWorkspaceWindow(params: {
    userId: string;
    title: string;
    goalType: Workspace['goalType'];
    windowType: AppWindowState['windowType'];
  }): Promise<{ state: UserStateSnapshot; workspace: Workspace; window: AppWindowState }> {
    return this.mutate(() => {
      const state = this.getUserRef(params.userId);
      const workspace = createWorkspaceShell({
        title: params.title,
        goalType: params.goalType,
        windowType: params.windowType,
      });

      const window: AppWindowState = {
        workspaceId: workspace.id,
        windowType: params.windowType,
        title: params.title,
        isBackground: false,
        isPinned: false,
        openedAt: Date.now(),
      };

      state.workspaces.unshift(workspace);
      state.appWindows = [window, ...state.appWindows.filter((candidate) => candidate.workspaceId !== workspace.id)];
      state.activeWorkspaceId = workspace.id;
      state.updatedAt = Date.now();

      return { state: clone(state), workspace: clone(workspace), window: clone(window) };
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);

      state.workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
      state.appWindows = state.appWindows.filter((window) => window.workspaceId !== workspaceId);
      state.schedules = state.schedules.filter((schedule) => schedule.workspaceId !== workspaceId);
      state.ongoingMissions = state.ongoingMissions.filter((mission) => mission.workspaceId !== workspaceId);

      if (state.activeWorkspaceId === workspaceId) {
        state.activeWorkspaceId = state.appWindows[0]?.workspaceId ?? state.workspaces[0]?.id ?? null;
      }

      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async setActiveWorkspace(userId: string, workspaceId: string | null): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.activeWorkspaceId = workspaceId;
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async upsertWindow(userId: string, window: AppWindowState): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.appWindows = [window, ...state.appWindows.filter((candidate) => candidate.workspaceId !== window.workspaceId)];
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async closeWindow(userId: string, workspaceId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.appWindows = state.appWindows.filter((window) => window.workspaceId !== workspaceId);

      if (state.activeWorkspaceId === workspaceId) {
        state.activeWorkspaceId = state.appWindows[0]?.workspaceId ?? null;
      }

      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async upsertSchedule(userId: string, schedule: ScheduleSnapshot): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      const existingIndex = state.schedules.findIndex((candidate) => candidate.scheduleId === schedule.scheduleId);

      if (existingIndex >= 0) {
        state.schedules[existingIndex] = schedule;
      } else {
        state.schedules.unshift(schedule);
      }

      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async removeSchedule(userId: string, scheduleId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.schedules = state.schedules.filter((schedule) => schedule.scheduleId !== scheduleId);
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async listAllSchedules(): Promise<Array<{ userId: string; schedule: ScheduleSnapshot }>> {
    await this.ensureLoaded();

    return Object.values(this.db.users).flatMap((state) =>
      state.schedules.map((schedule) => ({ userId: state.userId, schedule: clone(schedule) }))
    );
  }

  async installAgent(userId: string, agentId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.installedAgentIds = Array.from(new Set([...state.installedAgentIds, agentId]));
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async addInboxEntry(
    userId: string,
    entry: Omit<NexusInboxEntry, 'id' | 'timestamp' | 'read'> & {
      timestamp?: string;
      read?: boolean;
    }
  ): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      const nextEntry: NexusInboxEntry = {
        id: `inbox_${crypto.randomUUID()}`,
        type: entry.type,
        title: entry.title,
        content: entry.content,
        priority: entry.priority,
        timestamp: entry.timestamp ?? new Date().toISOString(),
        read: entry.read ?? false,
      };

      state.inbox = [nextEntry, ...state.inbox].slice(0, 50);
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async markInboxRead(userId: string, entryId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.inbox = state.inbox.map((entry) =>
        entry.id === entryId ? { ...entry, read: true } : entry
      );
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async clearInbox(userId: string): Promise<UserStateSnapshot> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      state.inbox = [];
      state.updatedAt = Date.now();
      return clone(state);
    });
  }

  async completeNextAction(
    userId: string,
    workspaceId: string,
    actionId: string,
    message?: string
  ): Promise<Workspace | null> {
    return this.mutate(() => {
      const state = this.getUserRef(userId);
      const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);

      if (!workspace) return null;

      const completedAction = workspace.nextActions?.find((action) => action.id === actionId);
      workspace.nextActions = (workspace.nextActions ?? []).filter((action) => action.id !== actionId);
      workspace.activityLog = [
        {
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          type: 'execution',
          message:
            message ??
            `Completed action${completedAction ? `: ${completedAction.title}` : ''}`,
        },
        ...(workspace.activityLog ?? []),
      ];

      state.updatedAt = Date.now();
      return clone(ensureWorkspaceDefaults(workspace));
    });
  }
}

export const nexusStateStore = new NexusStateStore();
