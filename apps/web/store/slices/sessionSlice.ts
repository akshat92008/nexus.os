import { StateCreator } from 'zustand';
import { NexusStore, SessionMeta, LedgerState, WaveState, SynthesisResult } from '../types';

export interface SessionSlice {
  session: SessionMeta;
  ledger: LedgerState;
  waves: WaveState;
  synthesis: SynthesisResult;
  execution: {
    isExecuting: boolean;
    currentCommand: string;
    logs: string[];
    taskId: string | null;
  };

  setGoal: (goal: string) => void;
  setUserId: (userId: string) => void;
  startSession: (goal: string, userId: string) => void;
  resetWorkspace: () => void;
  clearHalt: () => void;

  setExecuting: (isExecuting: boolean, taskId?: string, cmd?: string) => void;
  appendExecutionLog: (log: string) => void;
  clearExecutionLogs: () => void;
}

const initialSession: SessionMeta = {
  id: '', goal: '', userId: '', startedAt: null, completedAt: null, durationMs: null, status: 'idle', systemPauseUntil: null, successCriteria: [],
};

const initialLedger: LedgerState = {
  totalFeeUsd: 0, totalTokensUsed: 0, transactionCount: 0, estimatedFeeUsd: 0, sequentialEstimate: 0,
};

export const createSessionSlice: StateCreator<
  NexusStore,
  [['zustand/subscribeWithSelector', never], ['zustand/persist', unknown]],
  [],
  SessionSlice
> = (set, get) => ({
  session: initialSession,
  ledger: initialLedger,
  waves: { currentWave: 0, totalWaves: 0, waveStatus: 'idle', recoveryCount: 0 },
  synthesis: { available: false },
  execution: { isExecuting: false, currentCommand: '', logs: [], taskId: null },

  setGoal: (goal) => set((s) => ({ session: { ...s.session, goal } })),
  setUserId: (userId) => set((s) => ({ session: { ...s.session, userId } })),

  startSession: (goal, userId) => set({
    session: { ...initialSession, id: crypto.randomUUID(), goal, userId, startedAt: Date.now(), status: 'routing' },
    waves: { currentWave: 0, totalWaves: 0, waveStatus: 'idle', recoveryCount: 0 },
    synthesis: { available: false },
    ledger: initialLedger,
  }),

  resetWorkspace: () => set({
    session: initialSession,
    ledger: initialLedger,
    synthesis: { available: false },
    waves: { currentWave: 0, totalWaves: 0, waveStatus: 'idle', recoveryCount: 0 },
    execution: { isExecuting: false, currentCommand: '', logs: [], taskId: null },
  }),

  clearHalt: () => set((s) => ({ session: { ...s.session, status: 'idle' } })),

  setExecuting: (isExecuting, taskId, cmd) => set((s) => ({
    execution: { ...s.execution, isExecuting, taskId: taskId || null, currentCommand: cmd || '' }
  })),

  appendExecutionLog: (log) => set((s) => ({
    execution: { ...s.execution, logs: [...s.execution.logs, log].slice(-500) }
  })),

  clearExecutionLogs: () => set((s) => ({
    execution: { ...s.execution, logs: [] }
  })),
});
