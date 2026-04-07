import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Bot, User, Zap, Activity, X, Shield, Cpu, Terminal } from 'lucide-react';

export function AgentsView() {
  const { ui, agents, toggleAgentsView } = useNexusStore();
  const agentList = Array.from(agents.values());

  if (!ui.agentsViewOpen) return null;

  const stats = {
    total: agentList.length,
    active: agentList.filter(a => a.status === 'working' || a.status === 'spawned').length,
    completed: agentList.filter(a => a.status === 'complete').length,
  };

  const agentTypes = [
    { type: 'researcher', label: 'Researcher', icon: Cpu, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { type: 'analyst', label: 'Strategic Analyst', icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { type: 'summarizer', label: 'Synthesizer', icon: Bot, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { type: 'developer', label: 'Core Architect', icon: Code, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-[#070514]/80 backdrop-blur-md p-4"
        onClick={toggleAgentsView}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-4xl bg-[#0f0c29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <Bot size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Agent Fleet Manager</h2>
                <p className="text-sm text-slate-400">Real-time status of specialized neural units</p>
              </div>
            </div>
            <button
              onClick={toggleAgentsView}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Total Deployed</div>
                <div className="text-3xl font-black text-white">{stats.total}</div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-emerald-400">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Success Units</div>
                <div className="text-3xl font-black">{stats.completed}</div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-cyan-400">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Active Threads</div>
                <div className="text-3xl font-black">{stats.active}</div>
              </div>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agentTypes.map((t) => {
                const count = agentList.filter(a => a.agentType === t.type).length;
                const working = agentList.filter(a => a.agentType === t.type && (a.status === 'working' || a.status === 'spawned')).length;
                
                return (
                  <div 
                    key={t.type} 
                    onClick={() => {
                      // Mock spawning an agent if none exist
                      if (count === 0) {
                        useNexusStore.getState().addInboxEntry({
                          type: 'agent',
                          title: `Neutral Unit: ${t.label}`,
                          content: `Booting up ${t.label} sub-routine...`,
                          priority: 'medium'
                        });
                      }
                    }}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer"
                  >
                    <div className={`p-3 rounded-xl ${t.bg} ${t.color}`}>
                      <t.icon size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">{t.label}</h3>
                        <span className="text-xs font-bold text-slate-500">{count > 0 ? count : 'Ready'} Units</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: count > 0 ? (working > 0 ? '100%' : '20%') : 0 }}
                            className={`h-full ${t.color.replace('text', 'bg')}`}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold">{working > 0 ? 'Executing' : count > 0 ? 'Standby' : 'Off-line'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="mt-8 flex gap-4">
               <button 
                  onClick={() => {
                     useNexusStore.getState().addInboxEntry({
                        type: 'system',
                        title: 'Fleet Synchronization',
                        content: 'All neural units are now synchronized with the latest mission parameters.',
                        priority: 'high'
                     });
                  }}
                  className="flex-1 py-3 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 font-bold text-xs uppercase tracking-widest hover:bg-violet-600/20 transition-all"
               >
                  Sync Fleet
               </button>
               <button 
                  onClick={() => {
                     useNexusStore.getState().toggleAgentsView();
                     useNexusStore.getState().setAppLauncherOpen(true);
                  }}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all"
               >
                  Deploy New Unit
               </button>
            </div>

            {/* System Info */}
            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><Shield size={12} className="text-emerald-500" /> Neural Lock: Active</span>
                <span className="flex items-center gap-1.5"><Terminal size={12} className="text-cyan-500" /> API: Groq Llama-3.3-70B</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                OS v2.0 Fleet Core
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Missing icon fix
const Code = ({ size, className }: { size: number; className?: string }) => <Terminal size={size} className={className} />;
