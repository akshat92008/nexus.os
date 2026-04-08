import { StateCreator } from 'zustand';
import { NexusStore, AppWindow, ScheduleConfigUI, ApplicationWindowType } from '../types';
import { Workspace, OngoingMission, WorkspaceTask, ActivityLog } from '@nexus-os/types';

export interface WorkspaceSlice {
  workspaces: Record<string, Workspace>;
  activeWorkspaceId: string | null;
  appWindows: Record<string, AppWindow>;
  schedules: Record<string, ScheduleConfigUI>;
  ongoingMissions: Record<string, OngoingMission>;

  setActiveWorkspace: (id: string | null) => void;
  updateSectionContent: (workspaceId: string, sectionId: string, newContent: any) => void;
  toggleTaskStatus: (workspaceId: string, sectionId: string, taskId: string) => void;
  deleteWorkspace: (id: string) => void;
  
  createWorkspaceShell: (type: ApplicationWindowType, title: string) => Promise<void>;
  openWindow: (workspaceId: string, type: ApplicationWindowType, title: string) => void;
  closeWindow: (workspaceId: string) => void;
  setWindowBackground: (workspaceId: string, isBackground: boolean) => void;
  pinWindow: (workspaceId: string, isPinned: boolean) => void;
  
  upsertSchedule: (config: ScheduleConfigUI) => void;
  removeSchedule: (scheduleId: string) => void;
  convertMissionToOngoing: (workspaceId: string) => void;
}

export const createWorkspaceSlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  WorkspaceSlice
> = (set, get) => ({
  workspaces: {},
  activeWorkspaceId: null,
  appWindows: {},
  schedules: {},
  ongoingMissions: {},

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

  updateSectionContent: (wsId, secId, content) => {
    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return {};
      const sections = ws.sections.map(sec => sec.id === secId ? { ...sec, content } : sec);
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

  deleteWorkspace: (id) => {
    set((s) => {
      const nextWorkspaces = { ...s.workspaces };
      const nextWindows = { ...s.appWindows };
      const nextSchedules = { ...s.schedules };
      const nextMissions = { ...s.ongoingMissions };

      delete nextWorkspaces[id];
      delete nextWindows[id];

      for (const [sid, schedule] of Object.entries(nextSchedules)) {
        if (schedule.workspaceId === id) delete nextSchedules[sid];
      }
      for (const [mid, mission] of Object.entries(nextMissions)) {
        if (mission.workspaceId === id) delete nextMissions[mid];
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
    set((s) => ({ schedules: { ...s.schedules, [config.scheduleId]: config } }));
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

  convertMissionToOngoing: (wsId) => {
    set((s) => {
      const ws = s.workspaces[wsId];
      if (!ws) return {};
      const mission: OngoingMission = {
        id: `om_${crypto.randomUUID()}`,
        goal: ws.goal,
        status: 'active',
        lastRun: Date.now(),
        nextRun: Date.now() + 86400000,
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
  
  createWorkspaceShell: async (type, title) => {
    // API interaction logic truncated here for brevity, usually calls applyServerSnapshot
  }
});
