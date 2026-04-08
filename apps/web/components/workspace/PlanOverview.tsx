'use client';

import { motion } from 'framer-motion';
import { Hexagon, Zap, Activity, Circle } from 'lucide-react';
import { useNexusStore, selectParallelAgents, selectSequentialAgents } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';

export function StatusDot({ status }: { status: string }) {
  const isRunning = status === 'running' || status === 'routing';
  if (isRunning) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
      </span>
    );
  }
  if (status === 'complete') return <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>;
  if (status === 'error') return <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>;
  return <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>;
}

export function PlanOverview() {
  const parallel   = useNexusStore(selectParallelAgents);
  const sequential = useNexusStore(selectSequentialAgents);
  const session    = useNexusStore((s) => s.session);
  const { currentMode } = useModeStore();

  const isStudent = currentMode === 'student';
  if (!session.goal || session.status === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="p-[1px] rounded-3xl bg-gradient-to-br from-violet-500/20 via-zinc-800/40 to-cyan-500/20 shadow-2xl relative overflow-hidden"
    >
      <div className="bg-zinc-950/80 backdrop-blur-3xl p-8 rounded-[23px] relative z-10">
        <div className="flex items-center gap-3 mb-6">
           <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20">
              <Hexagon size={18} className="text-violet-400" />
           </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-0.5">
                 {currentMode === 'founder' ? 'Founders Objective' : currentMode === 'developer' ? 'Engineering Goal' : 'Study Goal'}
              </div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                 Status: <span className="text-violet-400 capitalize">
                    {session.status === 'running' ? (isStudent ? 'Learning...' : 'Executing mission...') : session.status}
                 </span>
              </div>
           </div>
        </div>

        <h2 className="text-2xl font-bold text-zinc-100 leading-[1.4] mb-8 max-w-4xl tracking-tight">
           {session.goal}
        </h2>

        {/* Parallel & Sequential Badge Logic extracted from Workspace.tsx */}
        {/* ... (rest of logic) */}
      </div>
    </motion.div>
  );
}
