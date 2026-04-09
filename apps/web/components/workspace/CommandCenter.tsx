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
  const { ui, session, execution, activeWorkspaceId, setLayoutMode } = useNexusStore();
  const { currentMode } = useModeStore();
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Auto-morph triggers
  useEffect(() => {
    if (ui.activeArtifactId) {
      setLayoutMode('focus-workspace');
    } else if (execution.isExecuting) {
       // Optional: keep it in command-center or switch to graph?
       // Let's stay in command-center for multi-view visibility by default
    }
  }, [ui.activeArtifactId, execution.isExecuting, setLayoutMode]);

  // Layout logic for morphing
  const layoutMode = ui.layoutMode;
  
  const getGridTemplate = () => {
    switch (layoutMode) {
      case 'focus-graph': return '2fr 1fr / 2fr 1fr';
      case 'focus-workspace': return '1fr 2fr / 1fr 2fr';
      case 'focus-telemetry': return '1fr 1fr / 1fr 2fr';
      default: return '1fr 1fr / 1fr 1fr';
    }
  };

  return (
    <div className="h-full w-full bg-[#0F1115] relative p-4 gap-4 grid overflow-hidden transition-all duration-700 ease-in-out"
         style={{ gridTemplate: getGridTemplate() }}>
      
      {/* ZONE 1 (NW): REASONING GRAPH */}
      <ZoneWrapper 
        id="graph" 
        title="Neural Reasoning Graph" 
        icon={Brain} 
        color="text-violet-400"
        onHover={() => setHoveredZone('graph')}
        isExecuting={execution.isExecuting}
      >
        <GraphCanvas sessionId={session.id || 'initial'} />
      </ZoneWrapper>

      {/* ZONE 2 (NE): ACTIVE WORKSPACE */}
      <ZoneWrapper 
        id="workspace" 
        title={activeWorkspaceId ? "Active Mission Workspace" : "System Standby"} 
        icon={Zap} 
        color="text-cyan-400"
        onHover={() => setHoveredZone('workspace')}
      >
        <SandboxRouter />
      </ZoneWrapper>

      {/* ZONE 3 (SW): OMNI-CONSOLE */}
      <ZoneWrapper 
        id="console" 
        title="Omni-Command Interface" 
        icon={CommandIcon} 
        color="text-zinc-400"
        padding={false}
      >
        <div className="flex flex-col h-full bg-black/40">
           <div className="flex-1 overflow-hidden p-4">
              <OmniChatView />
           </div>
           <div className="p-4 border-t border-white/5 bg-black/20">
              <UniversalCommandBar isEmbedded />
           </div>
        </div>
      </ZoneWrapper>

      {/* ZONE 4 (SE): TELEMETRY FEED */}
      <ZoneWrapper 
        id="telemetry" 
        title="Execution Telemetry" 
        icon={Activity} 
        color="text-emerald-400"
        padding={false}
      >
        <TelemetryMonitor />
      </ZoneWrapper>

      {/* GLOBAL OVERLAY HUD DECORATION */}
      <div className="absolute inset-0 pointer-events-none z-[100] border border-white/5 rounded-3xl overflow-hidden">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 px-32 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 px-32 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>
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
