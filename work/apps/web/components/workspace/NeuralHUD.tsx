'use client';

import { Activity, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';

export function NeuralHUD() {
  const neuralInterrupts = useNexusStore((s) => s.neuralInterrupts);
  const clearInterrupt = useNexusStore((s) => s.clearInterrupt);

  if (neuralInterrupts.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-amber-400/80 px-2">
        <Activity size={14} className="animate-pulse" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Neural Interrupts</h3>
      </div>
      <div className="flex flex-col gap-3">
        {neuralInterrupts.map((int: any) => (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            key={int.id} 
            className="group relative bg-zinc-950/40 border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between backdrop-blur-xl overflow-hidden hover:border-amber-500/40 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent pointer-events-none" />
            <div className="flex gap-4 items-center relative z-10">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-200">{int.title}</h4>
                <p className="text-xs text-zinc-500 mt-1">{int.content}</p>
              </div>
            </div>
            <button 
              onClick={() => clearInterrupt(int.id)}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition-all focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              Dismiss
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
