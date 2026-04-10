/**
 * Nexus OS — Global State Store (Zustand)
 *
 * Single source of truth for the entire OS workspace.
 * Decomposed into modular slices for 'agentic accessibility'.
 */

'use client';

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { NexusStore, UserStateSnapshot } from './types';
import { API_BASE } from '../lib/constants';

// Slice Imports
import { createAgentSlice } from './slices/agentSlice';
import { createUISlice } from './slices/uiSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createSessionSlice } from './slices/sessionSlice';
import { createEcosystemSlice } from './slices/ecosystemSlice';
import { createEventSlice } from './slices/eventSlice';

// Helper Logic
const toWorkspaceRecord = (workspaces: any[]) =>
  Object.fromEntries(workspaces.map((w) => [w.id, w]));

const toWindowRecord = (windows: any[]) =>
  Object.fromEntries(windows.map((w) => [w.workspaceId, w]));

const toScheduleRecord = (schedules: any[]) =>
  Object.fromEntries(schedules.map((s) => [s.scheduleId, s]));

const toMissionRecord = (missions: any[]) =>
  Object.fromEntries(missions.map((m) => [m.id, m]));

function applyServerSnapshot(set: any, snapshot: UserStateSnapshot) {
  set({
    workspaces: toWorkspaceRecord(snapshot.workspaces || []),
    activeWorkspaceId: snapshot.activeWorkspaceId || null,
    appWindows: toWindowRecord(snapshot.appWindows || []),
    schedules: toScheduleRecord(snapshot.schedules || []),
    ongoingMissions: toMissionRecord(snapshot.ongoingMissions || []),
    inbox: snapshot.inbox || [],
    installedAgentIds: snapshot.installedAgentIds || [],
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
    finances: state.finances,
    timeTracking: state.timeTracking,
    invoicing: state.invoicing,
    calendar: state.calendar,
    updatedAt: Date.now(),
  };
}

export const useNexusStore = create<NexusStore>()(
  persist(
    subscribeWithSelector((set, get, store) => ({
      ...createAgentSlice(set, get, store),
      ...createUISlice(set, get, store),
      ...createWorkspaceSlice(set, get, store),
      ...createSessionSlice(set, get, store),
      ...createEcosystemSlice(set, get, store),
      ...createEventSlice(set, get, store),

      // Global Persistence & Hydration
      hydrateFromServer: async (userId) => {
        try {
          const response = await fetch(`${API_BASE}/api/state/${userId}`);
          if (!response.ok) throw new Error(`Hydration failed (${response.status})`);
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
          if (!response.ok) throw new Error(`Persistence failed (${response.status})`);
        } catch (err) {
          get().addToast('Failed to save workspace changes.');
        }
      },
    })),
    {
      name: 'nexus-os-v2.6-storage',
      // only persist core UI prefs. Never persist 'running' states which can lead to UI deadlocks.
      partialize: (state) => ({
        ui: state.ui,
        activeWorkspaceId: state.activeWorkspaceId,
        session: { 
          ...state.session, 
          status: 'idle', // Always boot to idle
          id: state.session.id 
        },
      }),
    }
  )
);
