'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronDown, ChevronRight, Zap, Link2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import {
  useNexusStore,
  selectParallelAgents,
  selectSequentialAgents,
  selectIsRunning,
  type AgentCard,
} from '../../store/nexusStore';
import type { AgentStatus, AgentType } from '@nexus-os/types';

const AGENT_CONFIG: Record<AgentType, { color: string; label: string; emoji: string }> = {
  researcher: { color: '#60a5fa', label: 'Researcher',  emoji: '🔬' },
  analyst:    { color: '#a78bfa', label: 'Analyst',     emoji: '📊' },
  writer:     { color: '#34d399', label: 'Writer',      emoji: '✍️' },
  coder:      { color: '#fb923c', label: 'Coder',       emoji: '💻' },
  strategist: { color: '#f472b6', label: 'Strategist',  emoji: '🎯' },
  summarizer: { color: '#facc15', label: 'Summarizer',  emoji: '⚡' },
  chief_analyst: { color: '#38bdf8', label: 'Chief Analyst', emoji: '🧠' },
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; icon: React.ReactNode; pulse: boolean }> = {
  idle:     { label: 'Idle',     icon: <Clock size={10} className="text-zinc-500" />,          pulse: false },
  spawned:  { label: 'Spawned',  icon: <Clock size={10} className="text-zinc-400" />,          pulse: false },
  working:  { label: 'Working',  icon: <Activity size={10} className="text-cyan-400" />,       pulse: true  },
  handoff:  { label: 'Handoff',  icon: <Link2 size={10} className="text-violet-400" />,        pulse: true  },
  complete: { label: 'Complete', icon: <CheckCircle2 size={10} className="text-emerald-400" />,pulse: false },
  error:    { label: 'Error',    icon: <AlertCircle size={10} className="text-red-400" />,     pulse: false },
  skipped:  { label: 'Skipped',  icon: <ChevronRight size={10} className="text-zinc-500" />,   pulse: false },
};

function AgentCardWidget({ agent }: { agent: AgentCard }) {
  const [expanded, setExpanded] = useState(false);
  const setActiveArtifact = useNexusStore((s) => s.setActiveArtifact);

  const cfg    = AGENT_CONFIG[agent.agentType];
  const status = STATUS_CONFIG[agent.status];
  const color  = cfg?.color ?? '#a1a1aa'; // zinc-400

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="rounded-xl border shadow-lg overflow-hidden bg-zinc-900/40 backdrop-blur-md"
      style={{
        borderColor: `${color}40`,
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="relative shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-inner"
            style={{ background: `${color}15`, border: `1px solid ${color}30` }}
          >
            {cfg?.emoji ?? '🤖'}
          </div>
          {status.pulse && (
            <span className="absolute -top-1 -right-1 inline-flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
              <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: color }} />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wide outline-none" style={{ color }}>
              {cfg?.label?.toUpperCase() ?? agent.agentType.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ background: `${color}10`, color, borderColor: `${color}30` }}>
              {agent.mode}
            </span>
          </div>
          <p className="text-xs text-zinc-400 truncate leading-tight mt-1 font-medium">
            {agent.taskLabel}
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold shrink-0 uppercase tracking-wider
            ${agent.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              agent.status === 'working' || agent.status === 'handoff' ? 'bg-zinc-800/80 border border-zinc-700 text-zinc-300' : 
              'bg-zinc-800 text-zinc-500 border border-transparent'
            }
          `}
        >
          {status.icon}
          {status.label}
        </div>

        {agent.artifact && (
          <ChevronDown
            size={14}
            className={`text-zinc-500 shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180 text-zinc-300' : ''}`}
          />
        )}
      </button>

      <AnimatePresence>
        {expanded && agent.artifact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800/60 bg-zinc-900/60"
          >
            <div className="px-3 py-3 space-y-3">
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-300 leading-relaxed font-mono max-h-32 overflow-y-auto">
                {agent.artifact.content}
              </div>
              <button
                onClick={() => setActiveArtifact(agent.taskId)}
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide transition-colors hover:brightness-125 uppercase"
                style={{ color }}
              >
                <ChevronRight size={12} />
                Expand Artifact
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PhaseHeader({ label, icon, count, color }: { label: string; icon: React.ReactNode; count: number; color: string; }) {
  return (
    <div className="flex items-center gap-3 px-1 mt-6 mb-3">
      <span style={{ color }} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest drop-shadow-sm">
        {icon}
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}60 0%, transparent 100%)` }} />
      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">{count} active</span>
    </div>
  );
}

export function TaskManagerWidget() {
  const parallelAgents   = useNexusStore(selectParallelAgents);
  const sequentialAgents = useNexusStore(selectSequentialAgents);
  const isRunning        = useNexusStore(selectIsRunning);
  const status           = useNexusStore((s) => s.session.status);

  const totalAgents  = parallelAgents.length + sequentialAgents.length;
  const doneCount    = [...parallelAgents, ...sequentialAgents].filter(
    (a) => a.status === 'complete'
  ).length;

  return (
    <div className="flex flex-col h-full bg-zinc-950/20">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          <Activity size={14} className="text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">
            Task Manager
          </span>
        </div>
        {totalAgents > 0 && (
          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-mono font-medium uppercase bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                Live
              </span>
            )}
            <span className="text-[11px] text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-1.5 rounded">
              {doneCount}/{totalAgents}
            </span>
          </div>
        )}
      </div>

      {totalAgents > 0 && (
        <div className="h-1 w-full bg-zinc-900 border-b border-zinc-800/50">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_10px_rgba(139,92,246,0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / totalAgents) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
        {totalAgents === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 py-16">
            <Activity size={32} className="text-zinc-500" />
            <p className="text-sm font-medium text-zinc-400 text-center uppercase tracking-wide">
              No Active Agents
            </p>
          </div>
        ) : (
          <div className="pb-6">
            {parallelAgents.length > 0 && (
              <div className="space-y-3">
                <PhaseHeader
                  label="Phase I: Parallel"
                  icon={<Zap size={12} />}
                  count={parallelAgents.length}
                  color="#22d3ee" // cyan-400
                />
                <AnimatePresence>
                  {parallelAgents.map((agent) => (
                    <AgentCardWidget key={agent.taskId} agent={agent} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {sequentialAgents.length > 0 && (
              <div className="space-y-3">
                <PhaseHeader
                  label="Phase II: Sequential"
                  icon={<Link2 size={12} />}
                  count={sequentialAgents.length}
                  color="#a78bfa" // violet-400
                />
                <AnimatePresence>
                  {sequentialAgents.map((agent) => (
                    <AgentCardWidget key={agent.taskId} agent={agent} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {status === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-5 mb-5 p-4 rounded-xl bg-zinc-950/60 border border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col items-center gap-3 backdrop-blur-md"
          >
            <div className="text-xs font-bold tracking-wide uppercase text-emerald-400 flex items-center gap-2">
              <CheckCircle2 size={16} />
              Mission Accomplished
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight text-center px-2">
              The AI workforce has finalized all research and synthesis. Download the consolidated intelligence report below.
            </p>
            <div className="flex w-full gap-2 mt-1">
              <button
                onClick={async () => {
                  const { exportArtifact } = await import('../../lib/exportArtifact');
                  const sessionId = useNexusStore.getState().session.id;
                  if (sessionId) exportArtifact(sessionId, 'markdown');
                }}
                className="flex-1 flex justify-center items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all"
              >
                📝 Get MarkDown
              </button>
              <button
                onClick={async () => {
                  const { exportArtifact } = await import('../../lib/exportArtifact');
                  const sessionId = useNexusStore.getState().session.id;
                  if (sessionId) exportArtifact(sessionId, 'pdf');
                }}
                className="flex-1 flex justify-center items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold transition-all"
              >
                📄 Get HTML
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
