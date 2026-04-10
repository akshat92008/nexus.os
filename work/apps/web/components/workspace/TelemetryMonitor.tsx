'use client';

import React, { useEffect, useRef } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Activity, 
  ShieldCheck, 
  FileCheck, 
  Cpu, 
  Terminal, 
  AlertTriangle,
  ArrowRight,
  Database
} from 'lucide-react';

const EVENT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  connected: { icon: ShieldCheck, color: 'text-emerald-400', label: 'SYSTEM INIT' },
  awaiting_approval: { icon: ShieldCheck, color: 'text-amber-400', label: 'AUDIT REQ' },
  plan_ready: { icon: Database, color: 'text-cyan-400', label: 'PLAN SYNC' },
  agent_spawn: { icon: Cpu, color: 'text-violet-400', label: 'AGENT SPAWN' },
  artifact_deposited: { icon: FileCheck, color: 'text-emerald-400', label: 'ARTIFACT' },
  wave_start: { icon: Activity, color: 'text-blue-400', label: 'EXEC WAVE' },
  wave_complete: { icon: ShieldCheck, color: 'text-zinc-500', label: 'WAVE DONE' },
  synthesis_start: { icon: Zap, color: 'text-fuchsia-400', label: 'CORE SYNTH' },
  sandbox_stdout: { icon: Terminal, color: 'text-zinc-400', label: 'EXEC OUT' },
  done: { icon: ShieldCheck, color: 'text-emerald-500', label: 'MISSION DONE' },
  error: { icon: AlertTriangle, color: 'text-rose-500', label: 'SYS ERROR' },
};

export function TelemetryMonitor() {
  const events = useNexusStore(s => s.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full bg-[#0A0C10] border-l border-white/5 font-mono">
      <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-zinc-500" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Live Telemetry</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-widest">Active Feed</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20 gap-4">
              <Terminal size={32} />
              <span className="text-[10px] uppercase tracking-widest">Awaiting Pulse...</span>
            </div>
          ) : (
            events.map((event, idx) => {
              const config = EVENT_CONFIG[event.type] || { icon: ArrowRight, color: 'text-zinc-500', label: event.type };
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="group flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[9px] font-bold tracking-tighter">
                    <div className={`flex items-center gap-1.5 ${config.color}`}>
                      <config.icon size={10} />
                      <span className="uppercase tracking-widest">{config.label}</span>
                    </div>
                    <span className="text-zinc-600 tabular-nums">{event.timestamp}</span>
                  </div>
                  <div className="pl-4 border-l border-white/5 text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors py-0.5 break-words">
                    {renderEventDetail(event)}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function renderEventDetail(event: any) {
  const raw = event.raw;
  switch (event.type) {
    case 'agent_spawn':
      return `Spawned [${raw.agentType}] for task: ${raw.taskLabel}`;
    case 'artifact_deposited':
      return `Deposited ${raw.agentType} artifact (Tokens: ${raw.tokensUsed})`;
    case 'wave_start':
      return `Initializing Execution Wave #${raw.waveIndex}`;
    case 'plan_ready':
      return `Strategic plan accepted. Estimated Fee: $${raw.estimatedFeeUsd}`;
    case 'error':
      return raw.message || 'Unknown execution failure encountered.';
    case 'awaiting_approval':
      return `Paused at Checkpoint: ${raw.taskLabel}`;
    case 'done':
      return `Mission complete. Total Fee: $${raw.totalFeeUsd}`;
    default:
      return JSON.stringify(raw).substring(0, 100);
  }
}
