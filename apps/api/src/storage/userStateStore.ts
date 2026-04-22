/**
 * Nexus OS — User State Store
 *
 * Manages the high-level UI and workspace configuration snapshots for users.
 * 
 * Refactored to delegate to a PersistenceProvider (Supabase or Local FS).
 */

import type { UserStateSnapshot, Workspace } from '@nexus-os/types';
import { getPersistenceProvider } from './persistenceFactory.js';

export function createDefaultUserState(userId: string): UserStateSnapshot {
  return {
    userId,
    activeWorkspaceId: null,
    workspaces: [],
    appWindows: [],
    schedules: [],
    ongoingMissions: [],
    inbox: [],
    installedAgentIds: ['researcher-standard', 'analyst-standard', 'strategist-standard'],
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
      recentEntries: [],
    },
    invoicing: {
      invoices: [],
    },
    calendar: {
      events: [],
    },
    updatedAt: Date.now(),
  };
}

export function ensureWorkspaceDefaults(workspace: Workspace): Workspace {
  return {
    ...workspace,
    nextActions: workspace.nextActions ?? [],
    activityLog: workspace.activityLog ?? [],
    metadata: workspace.metadata ?? {},
  };
}

export class UserStateStore {
  private get provider() {
    return getPersistenceProvider();
  }

  async getUserState(userId: string): Promise<UserStateSnapshot> {
    const data = await this.provider.getUserState(userId);

    if (!data) {
      return createDefaultUserState(userId);
    }

    const current = data as UserStateSnapshot;
    return {
      ...createDefaultUserState(userId),
      ...current,
      workspaces: (current.workspaces ?? []).map(ensureWorkspaceDefaults),
      updatedAt: current.updatedAt ?? Date.now(),
    };
  }

  async syncUserState(userId: string, patch: Partial<UserStateSnapshot>): Promise<UserStateSnapshot> {
    const currentState = await this.getUserState(userId);

    const nextState: UserStateSnapshot = {
      ...currentState,
      ...patch,
      updatedAt: Date.now(),
    };

    await this.provider.upsertUserState(userId, nextState);
    return nextState;
  }

  async mutateUserState(userId: string, mutator: (state: UserStateSnapshot) => void): Promise<UserStateSnapshot> {
    const state = await this.getUserState(userId);
    mutator(state);
    return this.syncUserState(userId, state);
  }

  async upsertWorkspace(userId: string, workspace: Workspace) {
    return this.mutateUserState(userId, (state) => {
      const idx = state.workspaces.findIndex(w => w.id === workspace.id);
      if (idx >= 0) state.workspaces[idx] = ensureWorkspaceDefaults(workspace);
      else state.workspaces.unshift(ensureWorkspaceDefaults(workspace));
    });
  }

  async deleteWorkspace(userId: string, workspaceId: string) {
    return this.mutateUserState(userId, (state) => {
      state.workspaces = state.workspaces.filter(w => w.id !== workspaceId);
      state.appWindows = state.appWindows.filter(w => w.workspaceId !== workspaceId);
      state.schedules = state.schedules.filter(s => s.workspaceId !== workspaceId);
      state.ongoingMissions = state.ongoingMissions.filter(m => m.workspaceId !== workspaceId);
      if (state.activeWorkspaceId === workspaceId) {
        state.activeWorkspaceId = state.appWindows[0]?.workspaceId ?? state.workspaces[0]?.id ?? null;
      }
    });
  }
}

export const userStateStore = new UserStateStore();
