import { StateCreator } from 'zustand';
import { NexusStore, InboxEntry, MemorySystems } from '../types';
import { FinancialState, TimeTrackingState } from '@nexus-os/types';
import { API_BASE } from '../../lib/constants';

export interface EcosystemSlice {
  inbox: InboxEntry[];
  finances: FinancialState;
  timeTracking: TimeTrackingState;
  invoicing: {
    invoices: any[];
  };
  calendar: {
    events: any[];
  };
  brainStats: {
    totalMissions: number;
    activeMissions: number;
    globalActions: number;
    opportunities: number;
    risks: number;
  };
  memorySystems: MemorySystems;
  availableAgents: any[];
  installedAgentIds: string[];
  globalRisks: any[];
  globalOpportunities: any[];
  globalActions: any[];
  neuralInterrupts: any[];
  fsItems: any[];
  isFsLoading: boolean;

  addInboxEntry: (entry: Omit<InboxEntry, 'id' | 'timestamp' | 'read'>) => void;
  markInboxRead: (id: string) => void;
  clearInbox: () => void;
  fetchBrainStats: () => Promise<void>;
  fetchAvailableAgents: () => Promise<void>;
  installAgent: (agentId: string) => Promise<void>;
  
  startTimeEntry: (taskId: string, label: string) => void;
  stopTimeEntry: () => void;
  deleteTimeEntry: (id: string) => void;

  createInvoice: (invoice: any) => void;
  deleteInvoice: (id: string) => void;
  updateInvoiceStatus: (id: string, status: 'paid' | 'pending' | 'overdue') => void;

  addCalendarEvent: (event: any) => void;
  deleteCalendarEvent: (id: string) => void;

  fetchFsItems: (parentId?: string) => Promise<void>;
  uploadFsFile: (name: string, content: string, parentId?: string) => Promise<void>;
  searchFs: (query: string) => Promise<void>;
}

const initialMemorySystems: MemorySystems = {
  shortTermContext: { lastLogin: Date.now(), recentDecisions: [] },
  preferences: { verbosity: 'detailed', riskTolerance: 'medium', defaultIntegrations: ['email', 'calendar'] },
  entityGraph: {},
};

export const createEcosystemSlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  EcosystemSlice
> = (set, get) => ({
  inbox: [],
  finances: {
    revenue: 125450, expenses: 45230, profit: 80220, cashPosition: 250000, runway: 16.7,
    revenueTrend: [], topRevenueSources: [], topExpenses: [], records: [],
  },
  timeTracking: { activeEntry: null, recentEntries: [] },
  invoicing: { invoices: [] },
  calendar: { events: [] },
  brainStats: { totalMissions: 0, activeMissions: 0, globalActions: 0, opportunities: 0, risks: 0 },
  memorySystems: initialMemorySystems,
  availableAgents: [],
  installedAgentIds: [],
  globalRisks: [],
  globalOpportunities: [],
  globalActions: [],
  neuralInterrupts: [],
  fsItems: [],
  isFsLoading: false,

  addInboxEntry: (entry) => set((s) => ({
    inbox: [{ ...entry, id: crypto.randomUUID(), timestamp: Date.now(), read: false }, ...s.inbox]
  })),

  markInboxRead: (id) => set((s) => ({
    inbox: s.inbox.map(e => e.id === id ? { ...e, read: true } : e)
  })),

  clearInbox: () => set({ inbox: [] }),

  startTimeEntry: (taskId, label) => set((s) => ({
    timeTracking: {
      ...s.timeTracking,
      activeEntry: { id: `time_${Date.now()}`, taskId, label, startTime: Date.now() }
    }
  })),

  stopTimeEntry: () => set((s) => {
    if (!s.timeTracking.activeEntry) return {};
    const durationMs = Date.now() - s.timeTracking.activeEntry.startTime;
    const entry = { ...s.timeTracking.activeEntry, durationMs, endTime: Date.now(), workspaceId: s.activeWorkspaceId || 'root' };
    return { timeTracking: { activeEntry: null, recentEntries: [entry, ...s.timeTracking.recentEntries] } };
  }),

  deleteTimeEntry: (id) => set((s) => ({
    timeTracking: { ...s.timeTracking, recentEntries: s.timeTracking.recentEntries.filter(e => e.id !== id) }
  })),

  createInvoice: (invoice) => set((s) => ({
    invoicing: { ...s.invoicing, invoices: [invoice, ...s.invoicing.invoices] }
  })),

  deleteInvoice: (id) => set((s) => ({
    invoicing: { ...s.invoicing, invoices: s.invoicing.invoices.filter(i => i.id !== id) }
  })),

  updateInvoiceStatus: (id, status) => set((s) => ({
    invoicing: { ...s.invoicing, invoices: s.invoicing.invoices.map(i => i.id === id ? { ...i, status } : i) }
  })),

  addCalendarEvent: (event) => set((s) => ({
    calendar: { ...s.calendar, events: [...s.calendar.events, event] }
  })),

  deleteCalendarEvent: (id) => set((s) => ({
    calendar: { ...s.calendar, events: s.calendar.events.filter(e => e.id !== id) }
  })),

  fetchBrainStats: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/brain/stats`, { credentials: 'include' });
      const stats = await res.json();
      set({ brainStats: stats });
    } catch (err) {
      console.error('[Store] Failed to fetch brain stats:', err);
    }
  },

  fetchAvailableAgents: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/agents`, { credentials: 'include' });
      const agents = await res.json();
      set({ availableAgents: agents });
    } catch (err) {
      console.error('[Store] Failed to fetch marketplace agents:', err);
    }
  },

  installAgent: async (agentId: string) => {
    try {
      await fetch(`${API_BASE}/api/marketplace/agents/${agentId}/install`, {
        method: 'POST',
        credentials: 'include',
      });
      set((state: any) => ({
        installedAgentIds: [...state.installedAgentIds, agentId],
      }));
    } catch (err) {
      console.error('[Store] Failed to install agent:', err);
    }
  },

  fetchFsItems: async (parentId = 'root') => {
    set({ isFsLoading: true });
    try {
      const response = await fetch(`${API_BASE}/api/fs/list?parentId=${parentId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch FS items');
      const items = await response.json();
      set({ fsItems: items, isFsLoading: false });
    } catch (err) {
      set({ isFsLoading: false });
      get().addToast('Error indexing NexusFS.');
    }
  },

  uploadFsFile: async (name, content, parentId = 'root') => {
    try {
      const response = await fetch(`${API_BASE}/api/fs/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content, parentId }),
      });
      if (!response.ok) throw new Error('Upload failed');
      const file = await response.json();
      set((s) => ({ fsItems: [file, ...s.fsItems] }));
      get().addToast(`File "${name}" synchronized to NexusFS.`);
    } catch (err) {
      get().addToast('Failed to upload file.');
    }
  },

  searchFs: async (query) => {
    if (!query) return get().fetchFsItems();
    set({ isFsLoading: true });
    try {
      const response = await fetch(`${API_BASE}/api/fs/search?q=${query}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Search failed');
      const items = await response.json();
      set({ fsItems: items, isFsLoading: false });
    } catch (err) {
      set({ isFsLoading: false });
    }
  },
});
