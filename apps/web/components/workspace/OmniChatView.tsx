'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { UniversalCommandBar } from './UniversalCommandBar';
import { useNexusStore } from '../../store/nexusStore';

export function OmniChatView() {
  const clearHalt = useNexusStore((s) => s.clearHalt);
  const setCommandBarFocused = useNexusStore((s) => s.setCommandBarFocused);

  // EMERGENCY: Force system into idle/editable state on landing
  useEffect(() => {
    clearHalt();
    // Wait for the unlock to propagate before focusing
    const timer = setTimeout(() => {
      setCommandBarFocused(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [clearHalt, setCommandBarFocused]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl mx-auto pb-60 fade-in">
      <div className="w-full space-y-16">
        
        {/* Classic Branding: "What can I do for you?" */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col items-center text-center space-y-8"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-px bg-gradient-to-r from-transparent to-violet-500/50" />
             <span className="text-sm font-bold uppercase tracking-[0.4em] text-violet-400 opacity-60">System Ready</span>
             <div className="w-12 h-px bg-gradient-to-l from-transparent to-violet-500/50" />
          </div>

          <h1 className="text-7xl font-bold text-white tracking-tight leading-none drop-shadow-2xl">
            What can I <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-violet-200 to-cyan-400 italic">do for you?</span>
          </h1>
          
          <p className="text-zinc-500 text-xl font-medium max-w-lg leading-relaxed">
            Nexus OS is synced and ready to orchestrate your next mission or solve your most complex problems.
          </p>
        </motion.div>

        {/* The Beautiful Chatbox - Large Scale Variant */}
        <div className="w-full scale-110 motion-safe:animate-pulse-subtle">
          <UniversalCommandBar />
        </div>

        {/* Subtle OS Interaction Hints */}
        <div className="flex justify-center gap-16 text-zinc-600/60 font-black text-[10px] uppercase tracking-[0.2em] pt-8">
           <div className="flex items-center gap-3"><span className="text-zinc-800">⌘K</span> Focus</div>
           <div className="flex items-center gap-3"><span className="text-zinc-800">/</span> Commands</div>
           <div className="flex items-center gap-3"><span className="text-zinc-800">SHIFT + ↑</span> New Line</div>
        </div>
      </div>
    </div>
  );
}
