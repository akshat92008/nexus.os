'use client';

import { useNexusStore } from '../../store/nexusStore';
import { Target, CheckCircle2, Zap, ArrowRight, Info } from 'lucide-react';
import type { NextAction } from '@nexus-os/types';
import { motion, AnimatePresence } from 'framer-motion';

export function NextActionPanel() {
  const activeId = useNexusStore(s => s.activeWorkspaceId);
  const workspaces = useNexusStore(s => s.workspaces);
  const session = useNexusStore(s => s.session);
  const completeAction = useNexusStore(s => s.completeNextAction);
  const executeAction  = useNexusStore(s => s.executeNextAction);

  if (!activeId) return null;
  const workspace = workspaces[activeId];
  
  const actions = workspace?.nextActions || [];

  if (actions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-950/20">
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
           <CheckCircle2 size={20} className="text-zinc-700" />
        </div>
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Inbox Zero</h3>
        <p className="text-xs text-zinc-600 mt-2 max-w-[200px] leading-relaxed">Your AI agents are handling the workload autonomously. No actions required.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950/40">
      <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
        <AnimatePresence mode="popLayout">
          {actions.map((action: NextAction) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={action.id}
              className="p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-violet-500/30 transition-all group relative overflow-hidden shadow-lg"
            >
              {/* Priority Accent */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${action.priority === 'high' ? 'bg-rose-500' : 'bg-violet-500'}`} />
              
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${action.priority === 'high' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-violet-500/10 border-violet-500/20 text-violet-400'}`}>
                          {action.type}
                       </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-100 leading-snug group-hover:text-white transition-colors">{action.title}</h4>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/50 flex items-start gap-3">
                   <Info size={14} className="text-zinc-600 shrink-0 mt-0.5" />
                   <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                      <span className="text-zinc-200 font-bold uppercase text-[9px] tracking-widest block mb-1">Reason</span>
                      {action.description}
                   </p>
                </div>

                <div className="flex items-center gap-2 overflow-hidden">
                  {action.type === 'execute' ? (
                    <button 
                      onClick={() => executeAction(workspace.id, action)}
                      disabled={session.status === 'error'}
                      className="w-full py-3 rounded-xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-violet-500 transition-all shadow-xl shadow-violet-600/20 flex items-center justify-center gap-2 group/btn active:scale-[0.98] disabled:opacity-50"
                    >
                      Approve & Execute <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => completeAction(workspace.id, action.id)}
                      className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <CheckCircle2 size={12} /> Mark as Complete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
