'use client';

import React from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { SandboxRouter } from './SandboxRouter';
import { NeuroDashboard } from './dashboard/NeuroDashboard';
import { HomeLandingView } from './HomeLandingView';

export function CommandCenter() {
  const { execution, activeWorkspaceId, ui } = useNexusStore();
  
  if (activeWorkspaceId || execution.isExecuting) {
    // Standard workspace view when a mission is active
    return (
      <div className="h-full w-full p-6">
        <SandboxRouter />
      </div>
    );
  }

  // If the user clicked "Dashboards" in the sidebar
  if (ui.dashboardOpen) {
    return <NeuroDashboard />;
  }

  // Default state: Immersive input box (Manus-style)
  return <HomeLandingView />;
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
