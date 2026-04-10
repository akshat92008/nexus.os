import { StateCreator } from 'zustand';
import { NexusStore, EventLogEntry, AgentCard } from '../types';
import { NexusSSEEvent, Artifact } from '@nexus-os/types';

export interface EventSlice {
  events: EventLogEntry[];
  ingestEvent: (event: NexusSSEEvent) => void;
}

export const createEventSlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  EventSlice
> = (set, get) => ({
  events: [],

  ingestEvent: (event: NexusSSEEvent) => {
    const entry: EventLogEntry = {
      id: crypto.randomUUID(),
      type: event.type,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      raw: event,
    };

    set((s) => ({ events: [...s.events, entry].slice(-100) }));

    switch (event.type) {
      case 'connected':
        set((s) => ({
          session: { ...s.session, id: (event as any).sessionId || s.session.id, status: 'running' },
          pendingApproval: null,
        }));
        break;

      case 'awaiting_approval':
        set({
          pendingApproval: {
            taskId: (event as any).taskId,
            taskLabel: (event as any).taskLabel,
            reason: (event as any).reason || 'Strategic Checkpoint: Your approval is required to proceed.'
          }
        });
        break;

      case 'plan_ready':
        set((s) => ({
          session: { ...s.session, status: 'running', goalType: (event as any).goalType, successCriteria: (event as any).successCriteria || [] },
          waves: { ...s.waves, totalWaves: (event as any).waveCount || 0, waveStatus: 'running' },
          ledger: { ...s.ledger, estimatedFeeUsd: (event as any).estimatedFeeUsd }
        }));
        break;

      case 'agent_spawn': {
        const card: AgentCard = {
          taskId: (event as any).taskId,
          taskLabel: (event as any).taskLabel,
          agentType: (event as any).agentType,
          mode: (event as any).mode,
          status: 'spawned',
          spawnedAt: Date.now(),
        };
        set((s) => {
          const next = new Map(s.agents);
          next.set((event as any).taskId, card);
          return { agents: next, session: { ...s.session, systemPauseUntil: null } };
        });
        break;
      }

      case 'artifact_deposited': {
        const artifact: Artifact = {
          agentId: (event as any).agentId,
          taskLabel: (event as any).taskLabel,
          agentType: (event as any).agentType,
          content: (event as any).preview,
          tokensUsed: (event as any).tokensUsed,
          depositedAt: (event as any).depositedAt,
        };
        set((s) => {
          const nextAgents = new Map(s.agents);
          const nextArtifacts = new Map(s.artifacts);
          const card = nextAgents.get((event as any).agentId);
          if (card) nextAgents.set((event as any).agentId, { ...card, status: 'complete', artifact });
          nextArtifacts.set((event as any).agentId, artifact);
          return { agents: nextAgents, artifacts: nextArtifacts };
        });
        get().addInboxEntry({
          type: 'agent',
          title: `Artifact: ${(event as any).taskLabel}`,
          content: `Agent ${(event as any).agentId} has deposited a new artifact.`,
          priority: 'medium'
        });
        break;
      }

      case 'wave_start':
        set((s) => ({
          waves: { ...s.waves, currentWave: (event as any).waveIndex, waveStatus: 'running' }
        }));
        break;

      case 'wave_complete':
        set((s) => ({
          waves: { ...s.waves, waveStatus: 'idle' }
        }));
        break;

      case 'synthesis_start':
        get().addToast('Critical Analysis: Starting multi-agent synthesis...');
        break;

      case 'sandbox_stdout':
        // Optional: append to a terminal buffer if visible
        break;

      case 'done':
        set((s) => ({
          session: { ...s.session, status: 'complete', completedAt: Date.now() },
          ledger: { ...s.ledger, totalFeeUsd: (event as any).totalFeeUsd }
        }));
        // Auto-persist on completion
        get().persistServerState();
        break;

      case 'error':
        set((s) => ({ session: { ...s.session, status: 'error' } }));
        get().addToast((event as any).message || 'An unexpected error occurred');
        break;
    }
  },
});
