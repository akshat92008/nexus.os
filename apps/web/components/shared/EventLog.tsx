'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, TerminalSquare } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import type { NexusSSEEvent } from '@nexus-os/types';

type EventType = NexusSSEEvent['type'];

const EVENT_META: Record<EventType, { label: string; color: string; icon: string }> = {
  connected:          { label: 'CONNECTED',    color: '#10b981', icon: '🔗' }, // emerald-500
  plan_ready:         { label: 'PLAN_READY',   color: '#a855f7', icon: '📋' }, // purple-500
  wave_start:         { label: 'WAVE_START',   color: '#6366f1', icon: '🌊' },
  wave_complete:      { label: 'WAVE_DONE',    color: '#22c55e', icon: '🏁' },
  retry_wave:         { label: 'RETRY_WAVE',   color: '#f97316', icon: '🔁' },
  synthesis_start:    { label: 'SYNTHESIS',    color: '#8b5cf6', icon: '🧠' },
  agent_spawn:        { label: 'SPAWN',        color: '#0ea5e9', icon: '🤖' }, // sky-500
  agent_working:      { label: 'WORKING',      color: '#eab308', icon: '⚡' }, // yellow-500
  artifact_deposited: { label: 'DEPOSITED',    color: '#34d399', icon: '📦' }, // emerald-400
  handoff:            { label: 'HANDOFF',      color: '#3b82f6', icon: '🔀' }, // blue-500
  ledger_update:      { label: 'BILLING',      color: '#f59e0b', icon: '💰' }, // amber-500
  system_pause:       { label: 'PAUSED',       color: '#f43f5e', icon: '⏸' },
  done:               { label: 'COMPLETE',     color: '#22c55e', icon: '✅' }, // green-500
  error:              { label: 'ERROR',        color: '#ef4444', icon: '❌' }, // red-500
};

function LogRow({
  id,
  type,
  timestamp,
  raw,
}: {
  id: string;
  type: EventType;
  timestamp: string;
  raw: NexusSSEEvent;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[type] ?? { label: type, color: '#71717a', icon: '•' }; // zinc-500

  const summary = (() => {
    const r = raw as unknown as Record<string, unknown>;
    switch (type) {
      case 'connected':          return r.message as string;
      case 'plan_ready':         return `[${r.parallelCount}P / ${r.sequentialCount}S] ~$${(r.estimatedFeeUsd as number)?.toFixed(2)} est.`;
      case 'wave_start':         return `Wave ${Number(r.waveIndex) + 1} started with ${r.taskCount} tasks`;
      case 'wave_complete':      return `Wave ${Number(r.waveIndex) + 1} complete: ${r.succeeded} succeeded, ${r.failed} failed`;
      case 'retry_wave':         return `Recovery wave ${r.retryCount} for ${Array.isArray(r.taskIds) ? r.taskIds.length : 0} tasks`;
      case 'synthesis_start':    return `Chief Analyst synthesizing results (${r.conflictsDetected} conflicts detected)`;
      case 'agent_spawn':        return `[${r.agentType}] ${r.taskLabel} (${r.mode})`;
      case 'agent_working':      return r.message as string;
      case 'artifact_deposited': return `[${r.agentType}] ${r.taskLabel} : ${r.tokensUsed} tokens`;
      case 'handoff':            return `Context merged → ${r.toAgentId}`;
      case 'ledger_update':      return `+ $${(r.feeUsd as number)?.toFixed(4)} (${r.taskType})`;
      case 'system_pause':       return `${r.reason} until ${new Date(r.pauseUntil as number).toLocaleTimeString()}`;
      case 'done':               return `${r.totalAgents} agents finished in ${r.durationMs}ms`;
      case 'error':              return r.message as string;
      default:                   return '';
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group cursor-pointer select-none font-mono"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start gap-2 py-1 px-1.5 hover:bg-zinc-800/40 transition-colors">
        <span className="text-[10px] mt-0.5 shrink-0 opacity-60">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[9px] text-zinc-600 opacity-80">{timestamp}</span>
            <span
              className="text-[9px] font-bold tracking-wider uppercase px-1 rounded-sm"
              style={{ color: meta.color, backgroundColor: `${meta.color}15` }}
            >
              {'> '} {meta.label}
            </span>
            <span className="text-[10px] text-zinc-400 flex-1 min-w-0 truncate">
              {summary}
            </span>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden text-[9px] text-zinc-500 mt-1
                           bg-zinc-950/80 border border-zinc-800/60 shadow-inner p-2 whitespace-pre-wrap break-all rounded"
              >
                {JSON.stringify(raw, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export function EventLog() {
  const events  = useNexusStore((s) => s.events);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="flex flex-col h-full bg-black/80 border-t border-zinc-800/80">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/50">
        <div className="flex items-center gap-2">
          <TerminalSquare size={13} className="text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Event Stream
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 font-medium">
          {events.length} logs
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 opacity-20">
            <span className="text-[10px] text-zinc-500 font-mono tracking-widest">
              {'> '}_ AWAITING INPUT
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((e) => (
              <LogRow
                key={e.id}
                id={e.id}
                type={e.type}
                timestamp={e.timestamp}
                raw={e.raw}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
