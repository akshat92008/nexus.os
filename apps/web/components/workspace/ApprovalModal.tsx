'use client';

import { useNexusStore } from '../../store/nexusStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export function ApprovalModal() {
  const pendingApproval = useNexusStore((s) => s.pendingApproval);
  const approveTask = useNexusStore((s) => s.approveTask);

  if (!pendingApproval) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="p-8 bg-gradient-to-br from-amber-500/10 to-transparent border-b border-zinc-800/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Strategic Checkpoint</h3>
                <p className="text-zinc-500 text-sm font-medium">Human-in-the-loop intervention required</p>
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">Pending Task</div>
              <div className="text-lg font-bold text-zinc-200">{pendingApproval.taskLabel}</div>
              <div className="mt-2 text-sm text-zinc-400 leading-relaxed italic">
                "{pendingApproval.reason}"
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            <p className="text-sm text-zinc-400 leading-relaxed">
              NexusOS has paused execution to prevent unnecessary token spend or strategic drift. 
              Review the mission progress so far on the Reasoning Canvas before deciding.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => approveTask(true)}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 group"
              >
                <ShieldCheck size={20} />
                Approve & Proceed
                <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => approveTask(false)}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-rose-900/40 hover:text-rose-400 border border-zinc-700 text-zinc-400 font-bold flex items-center justify-center gap-2 transition-all"
              >
                <XCircle size={20} />
                Reject & Pivot
              </button>
            </div>
          </div>

          <div className="px-8 py-4 bg-zinc-950/50 border-t border-zinc-800/50 text-center">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
              NexusOS Strategic Gate • Mission ID: {pendingApproval.taskId.split('_')[0]}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
