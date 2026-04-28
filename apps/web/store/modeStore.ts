/**
 * Nexus OS — Mode Store
 *
 * Tracks the global OS operating mode (Student | Founder | Developer).
 * This controls the UI transformation and intent-routing behavior.
 * Persistence: Auto-saves to localStorage for session continuity.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NexusMode = 'student' | 'founder' | 'developer';

interface ModeState {
  currentMode: NexusMode;
  setMode: (mode: NexusMode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set, get) => ({
      currentMode: 'student', // Default mode for the "Daily Work OS"

      setMode: (mode) => set({ currentMode: mode }),

      toggleMode: () => {
        const current = get().currentMode;
        if (current === 'student') set({ currentMode: 'founder' });
        else if (current === 'founder') set({ currentMode: 'developer' });
        else set({ currentMode: 'student' });
      },
    }),
    {
      name: 'nexus_mode_session',
    }
  )
);
