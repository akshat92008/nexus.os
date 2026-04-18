import { StateCreator } from 'zustand';
import { NexusStore, AgentCard } from '../types';
import { Artifact, AgentType } from '@nexus-os/types';

export interface AgentSlice {
  agents: Map<string, AgentCard>;
  artifacts: Map<string, Artifact>;
  installedAgentIds: string[];
  availableAgents: any[];
  
  spawnAgent: (agentType: AgentType) => Promise<void>;
  installAgent: (id: string) => void;
  fetchAvailableAgents: () => Promise<void>;
}

export const createAgentSlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  AgentSlice
> = (set, get) => ({
  agents: new Map(),
  artifacts: new Map(),
  installedAgentIds: ['researcher-standard', 'analyst-standard'],
  availableAgents: [],

  spawnAgent: async (agentType) => {
    try {
      get().addToast(`Spawning ${agentType} agent...`, 'info' as any);
      const res = await fetch(`${API_BASE}/api/agents/spawn`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, workspaceId: get().activeWorkspaceId })
      });
      if (!res.ok) throw new Error('Spawn failed');
      get().addToast(`Successfully spawned ${agentType} agent.`, 'success' as any);
    } catch (err: any) {
      get().addToast(`Failed to spawn agent: ${err.message}`, 'error' as any);
    }
  },

  installAgent: (id) => {
    set((s) => ({
      installedAgentIds: [...s.installedAgentIds, id]
    }));
  },

  fetchAvailableAgents: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/agents`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      set({ availableAgents: data });
    } catch (err: any) {
      console.error('[AgentSlice] Load failure:', err);
    }
  },
});
