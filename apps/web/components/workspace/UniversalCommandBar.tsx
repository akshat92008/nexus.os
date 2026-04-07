'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal, Zap, X, Search, Lightbulb, ArrowUp, Plus, Mic, Monitor, Globe, Mail, MessageSquare, Activity,
  FileText, Image as ImageIcon, Video, Calendar, DollarSign, Plane, TrendingUp as TrendingUpIcon, Target as TargetIcon
} from 'lucide-react';
import { useNexusStore, selectIsRunning } from '../../store/nexusStore';
import { useNexusSSE } from '../../hooks/useNexusSSE';
import { useModeStore } from '../../store/modeStore';

const STUDENT_QUICK_ACTIONS = [
  { text: 'Finish my assignment', icon: Search },
  { text: 'Explain topic deeply', icon: Lightbulb },
  { text: 'Prepare for exam', icon: Monitor },
  { text: 'Summarize my notes', icon: Globe },
  { text: 'Help with project', icon: MessageSquare },
];

const FOUNDER_QUICK_ACTIONS = [
  { text: 'Find Leads', icon: Search },
  { text: 'Analyze Rivals', icon: Globe },
  { text: 'Financial Health', icon: TrendingUpIcon },
  { text: 'Product Roadmap', icon: TargetIcon },
  { text: 'Track Time', icon: Clock },
  { text: 'Create Invoice', icon: FileText },
];

const DEVELOPER_QUICK_ACTIONS = [
  { text: 'Build a new feature', icon: Plus },
  { text: 'Debug existing code', icon: Activity },
  { text: 'Refactor for quality', icon: Terminal },
  { text: 'Design system architecture', icon: Zap },
  { text: 'Schedule Meeting', icon: Calendar },
];

const SUGGESTIONS = [
  { trigger: 'book', text: 'Book a flight to New York next month under $500', icon: Plane },
  { trigger: 'spend', text: 'Analyze my spending and create a budget', icon: DollarSign },
  { trigger: 'sched', text: 'Schedule a meeting with the team for tomorrow', icon: Calendar },
  { trigger: 'summarize', text: 'Summarize the latest financial report', icon: FileText },
  { trigger: 'invoice', text: 'Generate an invoice for Acme Corp for $1200', icon: FileText },
  { trigger: 'time', text: 'Start a timer for "Market Research"', icon: Clock },
];

export function UniversalCommandBar() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeSuggestions, setActiveSuggestions] = useState<typeof SUGGESTIONS>([]);
  const { 
    startOrchestration, 
    abort 
  } = useNexusSSE();
  const { currentMode } = useModeStore();

  const {
    session,
    ui,
    setCommandBarFocused: setFocused,
    resetWorkspace: resetWS,
    toggleAppLauncher,
    toggleSearchView,
    toggleDashboard,
    toggleLibraryView,
    fetchFsItems,
    addInboxEntry
  } = useNexusStore();

  const isRunning = useNexusStore(selectIsRunning);
  const isFocused = ui.commandBarFocused;
  const [isRecording, setIsRecording] = useState(false);

  const QUICK_ACTIONS = currentMode === 'student' 
    ? STUDENT_QUICK_ACTIONS 
    : currentMode === 'founder' 
    ? FOUNDER_QUICK_ACTIONS 
    : DEVELOPER_QUICK_ACTIONS;

  const placeholder = currentMode === 'developer' 
    ? 'State your engineering goal (e.g. "Build an auth hook")...' 
    : currentMode === 'founder'
    ? 'State your business mission (e.g. "Find SEO leads")...'
    : 'State your learning goal (e.g. "Understand Quantum Physics")...';

  const handleMicClick = () => {
    setIsRecording(true);
    addInboxEntry({
      type: 'system',
      title: 'Voice Engine Active',
      content: 'Listening for your intent...',
      priority: 'low'
    });
    setTimeout(() => {
      setIsRecording(false);
      setDraft('Summarize my recent research on AI trends');
    }, 2000);
  };

  const handleFileSystemToggle = () => {
    fetchFsItems('root');
    toggleLibraryView();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = useCallback(async (textOverride?: string) => {
    const goal = (textOverride || draft).replace(/^\/deploy\s*/i, '').trim();
    if (!goal || isRunning) return;
    const userId = session.userId || `user_${Math.random().toString(36).slice(2, 8)}`;
    await startOrchestration(goal, userId, currentMode);
  }, [draft, isRunning, session.userId, startOrchestration, currentMode]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const fileName = files[0].name;
      setDraft(`Analyze this file: ${fileName} and summarize key insights.`);
    }
  };

  useEffect(() => {
    if (draft.trim().length > 2) {
      const filtered = SUGGESTIONS.filter(s => s.trigger.includes(draft.toLowerCase()));
      setActiveSuggestions(filtered);
    } else {
      setActiveSuggestions([]);
    }
  }, [draft]);

  const handleAbort = useCallback(() => {
    abort();
    resetWS();
  }, [abort, resetWS]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const status = session.status;
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isIdle = status === 'idle' && !isRunning;

  if (!isIdle) {
    const statusMessage = currentMode === 'student' 
       ? 'Preparing your learning workspace...'
       : 'Thinking and analyzing...';

    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mx-auto space-y-3 z-20"
      >
        <div className="flex items-center gap-2 px-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            {currentMode === 'student' ? 'Mission Active' : 'Agents Working'}
          </span>
          <div className="flex-1 h-px bg-zinc-800/60" />
        </div>

        <motion.div
          className={`
            relative rounded-2xl border transition-all duration-300 overflow-hidden backdrop-blur-xl
            ${isRunning
              ? 'border-violet-500/50 bg-zinc-900/80 shadow-[0_0_30px_rgba(139,92,246,0.2)]'
              : isComplete
              ? 'border-emerald-500/40 bg-zinc-900/80'
              : isError
              ? 'border-red-500/40 bg-zinc-900/80'
              : 'border-zinc-700/60 bg-zinc-900/60'
            }
          `}
        >
          <div className="absolute left-5 top-4 flex items-center gap-2">
            <Zap size={16} className={`transition-colors ${isRunning ? 'text-violet-400 animate-pulse drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]' : 'text-zinc-500'}`} />
            <span className="text-sm font-mono text-zinc-500/80">/deploy</span>
          </div>

          <textarea
            value={draft || statusMessage || ''}
            disabled
            rows={1}
            className="w-full resize-none bg-transparent pt-4 pb-4 pl-[80px] pr-36 text-base text-zinc-400 outline-none cursor-not-allowed font-sans"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
            {isRunning ? (
              <button
                onClick={handleAbort}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-900/60"
              >
                <X size={12} /> Abort
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                {isComplete ? 'Complete' : 'Halted'}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-10 py-12 z-20 min-h-[70vh]"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[11px] font-medium transition-colors hover:border-zinc-700 cursor-pointer">
          Agentic OS — {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode
        </div>
      </div>
      
      <h1 className="text-5xl font-extrabold text-zinc-100 tracking-tight text-center">
        {currentMode === 'student' ? (
           <>What do you need <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">help</span> with?</>
        ) : (
           <>What do you want to get <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">done?</span></>
        )}
      </h1>

      <div className="w-full max-w-[800px] flex flex-col items-center space-y-6">
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          animate={{
             boxShadow: isFocused ? '0 0 0 1px rgba(139, 92, 246, 0.4), 0 20px 40px rgba(139, 92, 246, 0.1)' : '0 20px 40px rgba(0,0,0, 0.2)',
             scale: isDragging ? 1.02 : 1,
             borderColor: isDragging ? 'rgba(139, 92, 246, 0.5)' : 'rgba(39, 39, 42, 0.8)',
          }}
          className={`w-full rounded-2xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden backdrop-blur-xl transition-all duration-300 relative ${isDragging ? 'bg-violet-500/5' : ''}`}
        >
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-violet-500/10 backdrop-blur-sm z-50 pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-violet-400">
                <Plus size={32} className="animate-bounce" />
                <span className="text-sm font-bold uppercase tracking-wider">Drop to Analyze Content</span>
              </div>
            </div>
          )}

          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Delay blur to allow clicking suggestions
              setTimeout(() => setFocused(false), 200);
            }}
            placeholder={placeholder}
            className="w-full h-32 resize-none bg-transparent px-6 py-5 text-lg text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed transition-all font-sans"
          />

          {activeSuggestions.length > 0 && isFocused && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-6 right-6 bottom-16 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-50 backdrop-blur-2xl"
            >
              <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-800/20 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Contextual Suggestions
              </div>
              {activeSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDraft(s.text);
                    handleSubmit(s.text);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-500/10 text-zinc-300 transition-colors text-left border-b border-zinc-800/30 last:border-0"
                >
                  <s.icon size={16} className="text-violet-400" />
                  <span className="text-sm font-medium">{s.text}</span>
                </button>
              ))}
            </motion.div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/40 bg-zinc-950/20">
             <div className="flex items-center gap-2">
                <button 
                  onClick={toggleAppLauncher}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                   <Plus size={18} />
                </button>
                <div className="h-4 w-px bg-zinc-800/60 mx-1" />
                <button 
                  onClick={toggleDashboard}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                   <Monitor size={18} />
                </button>
                <button 
                  onClick={toggleSearchView}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                   <Globe size={18} />
                </button>
                <button 
                  onClick={handleFileSystemToggle}
                  className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                   <FileText size={18} />
                </button>
             </div>
             
             <div className="flex items-center gap-3">
                <button 
                  onClick={handleMicClick}
                  className={`p-2 rounded-full transition-colors group ${isRecording ? 'bg-red-500/10 text-red-500' : 'hover:bg-zinc-800 text-zinc-500'}`}
                >
                   <Mic size={18} className={isRecording ? 'animate-pulse' : ''} />
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={!draft.trim()}
                  className="p-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale"
                >
                   <ArrowUp size={18} />
                </button>
             </div>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {QUICK_ACTIONS.map((eg, idx) => {
          const Icon = eg.icon;
          return (
            <button
              key={idx}
              onClick={() => {
                setDraft(eg.text);
                inputRef.current?.focus();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all text-sm text-zinc-400 font-medium"
            >
              <Icon size={14} className="text-zinc-500" />
              {eg.text}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
