import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Bot, User, Zap, Activity, X, Shield, Cpu, Terminal, Code } from 'lucide-react';

export function AgentsView() {
  const { agents } = useNexusStore();
  const agentList = Array.from(agents.values());

  const getAgentColor = (type: string) => {
    if (type === 'researcher') return 'text-cyan-400';
    if (type === 'analyst') return 'text-violet-400';
    if (type === 'coder') return 'text-emerald-400';
    if (type === 'writer') return 'text-pink-400';
    return 'text-zinc-400';
  };

  const getAgentIcon = (type: string) => {
    if (type === 'researcher') return Cpu;
    if (type === 'analyst') return Zap;
    if (type === 'coder') return Code;
    if (type === 'writer') return Terminal;
    return Bot;
  };

  return (
    <div className="flex flex-col gap-1 p-4">
      <AnimatePresence mode="popLayout">
        {agentList.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center justify-center py-10 gap-3 opacity-30 grayscale"
          >
             <Bot size={32} className="text-zinc-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Fleet Offline</span>
          </motion.div>
        ) : (
          agentList.map((agent) => {
            const Icon = getAgentIcon(agent.agentType);
            const colorClass = getAgentColor(agent.agentType);
            const isWorking = agent.status === 'working' || agent.status === 'spawned';

            return (
              <motion.div
                key={agent.taskId}
                layout
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-black/40 border border-white/5 ${colorClass} ${isWorking ? 'animate-pulse' : ''}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[11px] font-bold text-zinc-200 truncate">{agent.agentType}</h4>
                       <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                          agent.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                          isWorking ? 'bg-violet-500/10 text-violet-400' :
                          'bg-zinc-800 text-zinc-500'
                       }`}>
                          {agent.status}
                       </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium truncate mt-0.5">
                       {agent.taskLabel}
                    </p>
                  </div>
                </div>
                
                {isWorking && (
                  <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                     <motion.div 
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className={`h-full w-1/3 bg-current ${colorClass.replace('text', 'bg')}`}
                     />
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </div>
  );
}
