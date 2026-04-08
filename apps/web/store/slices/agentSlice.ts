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
    // Logic for spawning agents manually (simulated or real call)
    get().addToast(`Spawning ${agentType} agent...`);
  },

  installAgent: (id) => {
    set((s) => ({
      installedAgentIds: [...s.installedAgentIds, id]
    }));
  },

  fetchAvailableAgents: async () => {
    // API call placeholder
  },
});
