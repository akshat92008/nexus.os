'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Zap, X, Search, Lightbulb, Monitor, Globe, MessageSquare, Plus, Activity, Calendar, Clock, FileText, TrendingUp as TrendingUpIcon, Target as TargetIcon } from 'lucide-react';
import { useNexusStore, selectIsRunning } from '../../store/nexusStore';
import { useNexusSSE } from '../../hooks/useNexusSSE';
import { useModeStore } from '../../store/modeStore';
import { CommandInput } from './CommandInput';

const QUICK_ACTIONS = {
  student: [
    { text: 'Finish my assignment', icon: Search },
    { text: 'Explain topic deeply', icon: Lightbulb },
    { text: 'Prepare for exam', icon: Monitor },
    { text: 'Summarize my notes', icon: Globe },
  ],
  founder: [
    { text: 'Find Leads', icon: Search },
    { text: 'Analyze Rivals', icon: Globe },
    { text: 'Financial Health', icon: TrendingUpIcon },
    { text: 'Product Roadmap', icon: TargetIcon },
  ],
  developer: [
    { text: 'Build a new feature', icon: Plus },
    { text: 'Debug existing code', icon: Activity },
    { text: 'Refactor for quality', icon: Terminal },
    { text: 'Schedule Meeting', icon: Calendar },
  ]
};

export function UniversalCommandBar({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { startOrchestration, abort } = useNexusSSE();
  const { currentMode } = useModeStore();
  const isRunning = useNexusStore(selectIsRunning);

  const {
    session, ui, setCommandBarFocused: setFocused, resetWorkspace: resetWS,
    toggleAppLauncher, toggleSearchView, toggleDashboard, toggleLibraryView, fetchFsItems
  } = useNexusStore();

  const detectedMode = draft.toLowerCase().match(/(code|build|debug|refactor)/) ? 'developer' : draft.toLowerCase().match(/(market|lead|roi|revenue)/) ? 'founder' : 'student';
  const previewAgents = detectedMode === 'developer' ? ['Architect', 'Coder'] : detectedMode === 'founder' ? ['Strategist', 'Researcher'] : ['Researcher', 'Writer'];

  const handleSubmit = useCallback(async (textOverride?: string) => {
    const goal = (textOverride || draft).trim();
    if (!goal || isRunning) return;
    await startOrchestration(goal, session.userId, currentMode);
  }, [draft, isRunning, session.userId, startOrchestration, currentMode]);

  const handleAbort = async () => { 
    resetWS(); // Force local state reset immediately
    try {
      await abort(); // Attempt server-side cancellation
    } catch (e) {
      console.warn('[UI] Background abort attempt failed, but local state was reset.', e);
    }
  };

  const isTrulyRunning = isRunning || (session.status !== 'idle' && session.goal && session.id);

  if (isTrulyRunning) {
    return (
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl mx-auto space-y-3 pointer-events-auto z-[300]">
        <div className="relative rounded-2xl border border-violet-500/50 bg-zinc-900/80 p-4 flex items-center justify-between backdrop-blur-xl">
           <div className="flex items-center gap-3">
              <Zap size={16} className="text-violet-400 animate-pulse" />
              <span className="text-sm text-zinc-400 font-medium">Mission in progress: {session.goal}</span>
           </div>
           <button onClick={handleAbort} className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-950/40 text-xs font-semibold text-red-400 hover:bg-red-900/60 transition-all">
              <X size={12} className="inline mr-1" /> Abort
           </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full ${isEmbedded ? '' : 'max-w-4xl mx-auto space-y-10 z-[200] pointer-events-auto'}`}>
      <CommandInput
        draft={draft} setDraft={setDraft}
        isFocused={ui.commandBarFocused} setFocused={setFocused}
        isDragging={isDragging} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
        onSubmit={handleSubmit} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
        onMicClick={() => {}} isRecording={false}
        placeholder={`State your ${currentMode} mission...`}
        detectedMode={detectedMode} previewAgents={previewAgents} activeSuggestions={[]}
        toggleAppLauncher={toggleAppLauncher} toggleDashboard={toggleDashboard}
        toggleSearchView={toggleSearchView} toggleLibraryView={() => { fetchFsItems('root'); toggleLibraryView(); }}
      />
      {!isEmbedded && (
        <div className="flex flex-wrap justify-center gap-3">
          {(QUICK_ACTIONS[currentMode as keyof typeof QUICK_ACTIONS] || []).map((eg, idx) => (
            <button key={idx} onClick={() => setDraft(eg.text)} className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-800/60 text-sm text-zinc-400 transition-all">
              <eg.icon size={14} /> {eg.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
