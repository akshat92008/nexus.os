import { StateCreator } from 'zustand';
import { NexusStore } from '../types';

export interface UISlice {
  ui: {
    commandBarFocused: boolean;
    activeArtifactId: string | null;
    sidebarExpanded: boolean;
    exportModalOpen: boolean;
    appLauncherOpen: boolean;
    agentsViewOpen: boolean;
    searchViewOpen: boolean;
    libraryViewOpen: boolean;
    inboxOpen: boolean;
    dashboardOpen: boolean;
    financialViewOpen: boolean;
    timeTrackingViewOpen: boolean;
    invoicingViewOpen: boolean;
    calendarViewOpen: boolean;
    graphViewOpen: boolean;
    isOnboardingComplete: boolean;
  };
  toasts: Array<{ id: string; message: string; count: number; timestamp: number }>;
  pendingApproval: { taskId: string; taskLabel: string; reason: string } | null;

  setCommandBarFocused: (v: boolean) => void;
  setActiveArtifact: (id: string | null) => void;
  toggleSidebar: () => void;
  setExportModalOpen: (v: boolean) => void;
  addToast: (message: string) => void;
  removeToast: (id: string) => void;
  
  toggleAppLauncher: () => void;
  toggleAgentsView: () => void;
  toggleSearchView: () => void;
  toggleLibraryView: () => void;
  toggleInbox: () => void;
  toggleDashboard: () => void;
  toggleFinancialView: () => void;
  toggleTimeTrackingView: () => void;
  toggleInvoicingView: () => void;
  toggleCalendarView: () => void;
  toggleGraphView: () => void;
  closeAllModals: () => void;
  setAppLauncherOpen: (v: boolean) => void;
  setOnboardingComplete: () => void;
}

export const createUISlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  UISlice
> = (set, get) => ({
  ui: {
    commandBarFocused: false,
    activeArtifactId: null,
    sidebarExpanded: true,
    exportModalOpen: false,
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
    isOnboardingComplete: false,
  },
  toasts: [],
  pendingApproval: null,

  setCommandBarFocused: (v) => set((s) => ({ ui: { ...s.ui, commandBarFocused: v } })),
  setActiveArtifact: (id) => set((s) => ({ ui: { ...s.ui, activeArtifactId: id } })),
  toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarExpanded: !s.ui.sidebarExpanded } })),
  setExportModalOpen: (v) => set((s) => ({ ui: { ...s.ui, exportModalOpen: v } })),
  
  addToast: (message) => {
    const { toasts } = get();
    const now = Date.now();
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

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  setAppLauncherOpen: (v) => set((s) => ({ ui: { ...s.ui, appLauncherOpen: v } })),
  setShowAuth: (v) => set((s) => ({ ui: { ...s.ui, showAuth: v } })),

  toggleAppLauncher: () => set((s) => ({
    ui: { ...s.ui, appLauncherOpen: !s.ui.appLauncherOpen, agentsViewOpen: false, searchViewOpen: false, libraryViewOpen: false }
  })),

  toggleAgentsView: () => set((s) => ({
    ui: { ...s.ui, agentsViewOpen: !s.ui.agentsViewOpen, appLauncherOpen: false, searchViewOpen: false, libraryViewOpen: false }
  })),

  toggleSearchView: () => set((s) => ({
    ui: { ...s.ui, searchViewOpen: !s.ui.searchViewOpen, appLauncherOpen: false, agentsViewOpen: false, libraryViewOpen: false }
  })),

  toggleLibraryView: () => set((s) => ({
    ui: { ...s.ui, libraryViewOpen: !s.ui.libraryViewOpen, appLauncherOpen: false, agentsViewOpen: false, searchViewOpen: false, inboxOpen: false }
  })),

  toggleInbox: () => set((s) => ({
    ui: { ...s.ui, inboxOpen: !s.ui.inboxOpen, appLauncherOpen: false, agentsViewOpen: false, searchViewOpen: false, libraryViewOpen: false }
  })),

  toggleDashboard: () => set((s) => ({
    ui: { ...s.ui, dashboardOpen: !s.ui.dashboardOpen, appLauncherOpen: false, agentsViewOpen: false, searchViewOpen: false, libraryViewOpen: false, inboxOpen: false }
  })),

  toggleFinancialView: () => set((s) => ({
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

  toggleTimeTrackingView: () => set((s) => ({
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

  toggleInvoicingView: () => set((s) => ({
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

  toggleCalendarView: () => set((s) => ({
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

  toggleGraphView: () => set((s) => ({
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

  closeAllModals: () => set((s) => ({
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
  setOnboardingComplete: () => {
    set((s) => ({ ui: { ...s.ui, isOnboardingComplete: true } }));
    void get().persistServerState();
  },
});
