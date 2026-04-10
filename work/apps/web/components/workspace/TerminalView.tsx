'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Terminal, Copy, Trash2, Zap, Circle, Search } from 'lucide-react';

export function TerminalView() {
  const { execution, clearExecutionLogs } = useNexusStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [execution.logs]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl overflow-hidden shadow-2xl"
    >
      {/* 🚀 Terminal Header */}
      <div className="h-12 px-6 flex items-center justify-between bg-white/[0.03] border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Terminal size={14} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-black text-zinc-500">Sandbox Terminal</div>
            <div className="flex items-center gap-1.5 mt-0.5">
               <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[200px]">
                 {execution.currentCommand || 'Waiting for process...'}
               </span>
               {execution.isExecuting && (
                 <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase"
                 >
                   Live
                 </motion.div>
               )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={clearExecutionLogs}
             className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-500 hover:text-zinc-300"
             title="Clear Logs"
           >
             <Trash2 size={14} />
           </button>
           <div className="h-4 w-[1px] bg-white/10 mx-1" />
           <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
              <Circle size={8} className={execution.isExecuting ? 'text-emerald-500 fill-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-zinc-600'} />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                {execution.isExecuting ? 'Active Process' : 'Standby'}
              </span>
           </div>
        </div>
      </div>

      {/* 🧾 Log Outlet */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 font-mono text-[12px] leading-relaxed custom-scrollbar selection:bg-emerald-500/30"
      >
        <AnimatePresence mode="popLayout">
          {execution.logs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center gap-4 opacity-20 grayscale"
            >
               <Zap size={32} className="text-zinc-500" />
               <p className="text-center max-w-[200px] leading-normal uppercase tracking-widest text-[10px] font-bold">
                 Initialize an agentic mission to see live execution data
               </p>
            </motion.div>
          ) : (
            execution.logs.map((log, i) => {
              const isError = log.includes('[STDERR]') || log.toLowerCase().includes('error');
              const isOutput = log.includes('[STDOUT]');
              const cleanLog = log.replace(/\[STDOUT\] |\[STDERR\] /, '');

              return (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-1 flex gap-3 group"
                >
                  <span className="text-zinc-700 shrink-0 select-none w-4 text-right">{i + 1}</span>
                  <div className={`flex-1 break-all whitespace-pre-wrap ${
                    isError ? 'text-rose-400 font-medium' : 
                    isOutput ? 'text-emerald-400/90' : 
                    'text-zinc-400'
                  }`}>
                    {cleanLog}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* ⌨️ Command Indicator */}
      <div className="px-6 py-3 bg-black/40 border-t border-white/5 flex items-center gap-3">
         <span className="text-zinc-500 font-bold select-none text-[11px]">$</span>
         <div className="flex-1 overflow-hidden">
            <div className="text-[11px] font-mono text-zinc-400 truncate">
               {execution.isExecuting ? (
                 <span className="animate-pulse">_</span>
               ) : (
                 'Ready for next command'
               )}
            </div>
         </div>
         <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/10 opacity-40">
            <kbd className="text-[9px] font-mono text-zinc-500">⌘</kbd>
            <kbd className="text-[9px] font-mono text-zinc-500">K</kbd>
         </div>
      </div>
    </motion.div>
  );
}
