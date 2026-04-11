'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';
import { GraphCanvas } from './GraphCanvas';
import { SandboxRouter } from './SandboxRouter';
import { TelemetryMonitor } from './TelemetryMonitor';
import { OmniChatView } from './OmniChatView';
import { UniversalCommandBar } from './UniversalCommandBar';
import { 
  Maximize2, 
  Minimize2, 
  LayoutGrid, 
  Activity, 
  Zap, 
  Brain, 
  Command as CommandIcon 
} from 'lucide-react';

export function CommandCenter() {
  const { ui, session, execution, activeWorkspaceId } = useNexusStore();
  
  if (activeWorkspaceId || execution.isExecuting) {
    // Standard workspace view when a mission is active
    return (
      <div className="h-full w-full p-6">
        <SandboxRouter />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-4xl flex flex-col items-center z-10"
      >
        <h1 className="text-6xl font-medium tracking-tight text-white mb-12 flex items-center gap-4">
          What can I <span className="italic font-light text-zinc-400">do for you?</span>
        </h1>

        <UniversalCommandBar />

        {/* Action Suggestion Tags */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { label: 'Create slides', icon: LayoutGrid },
            { label: 'Build website', icon: Zap },
            { label: 'Develop desktop apps', icon: LayoutGrid },
            { label: 'Design', icon: Zap },
            { label: 'More', icon: null }
          ].map((action, i) => (
            <button 
              key={i}
              className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition-all text-sm font-medium text-zinc-400 hover:text-white flex items-center gap-2"
            >
              {action.icon && <action.icon size={14} />}
              {action.label}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

interface ZoneProps {
  id: string;
  title: string;
  icon: any;
  color: string;
  children: React.ReactNode;
  onHover?: () => void;
  isExecuting?: boolean;
  padding?: boolean;
}

function ZoneWrapper({ id, title, icon: Icon, color, children, onHover, isExecuting, padding = true }: ZoneProps) {
  const setLayoutMode = useNexusStore(s => s.setLayoutMode);
  const layoutMode = useNexusStore(s => s.ui.layoutMode);
  const isFocused = layoutMode === `focus-${id}`;

  return (
    <motion.div
      layout
      onMouseEnter={onHover}
      className={`relative rounded-3xl border border-white/5 bg-[#14171C]/50 backdrop-blur-3xl overflow-hidden flex flex-col group transition-all duration-500 ${
        isExecuting && id === 'graph' ? 'shadow-[0_0_40px_rgba(139,92,246,0.1)] border-violet-500/20' : ''
      }`}
    >
      <div className="h-10 px-6 flex items-center justify-between bg-white/[0.02] border-b border-white/5 shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg bg-black/20 ${color}`}>
            <Icon size={12} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-300 transition-colors">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setLayoutMode(isFocused ? 'command-center' : `focus-${id}` as any)}
            className="p-1.5 hover:bg-white/5 rounded-md text-zinc-600 hover:text-zinc-300 transition-all"
          >
            {isFocused ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
      <div className={`flex-1 relative overflow-hidden ${padding ? 'p-2' : ''}`}>
        {children}
      </div>
    </motion.div>
  );
}
