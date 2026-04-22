'use client';

import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

export interface MissionPlanStep {
  step: number;
  desc: string;
  tool: string;
  params: any;
}

export interface MissionData {
  mission: string;
  plan: MissionPlanStep[];
  current_step: number;
  status: 'planning' | 'executing' | 'completed' | 'error';
}

export const MissionTracker: React.FC = () => {
  const [sessionData, setSessionData] = useState<MissionData | null>(null);

  useEffect(() => {
    // Listen for real-time mission updates from Rust
    const unlisten = listen<MissionData>('mission-update', (event) => {
      setSessionData(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!sessionData) {
    return (
      <div className="flex-grow flex items-center justify-center text-white/30 font-mono text-sm">
        Awaiting Mission Assignment...
      </div>
    );
  }

  const { mission, plan, current_step, status } = sessionData;
  const totalSteps = plan.length;
  const progressPercent = totalSteps > 0 ? (current_step / totalSteps) * 100 : 0;

  return (
    <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6 font-mono text-sm scrollbar-hide" style={{ maxHeight: '60vh' }}>
      
      {/* Header and Progress Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg shadow-xl shrink-0">
        <h2 className="text-xl font-bold text-white tracking-wide mb-2 flex items-center gap-3">
          <span className="text-blue-400">ACTIVE MISSION:</span>
          {mission}
        </h2>
        
        <div className="flex items-center justify-between text-white/50 text-xs mb-3 font-semibold uppercase tracking-widest">
          <span>{status === 'planning' ? 'Planning Sequence...' : status === 'executing' ? 'Execution Mode' : 'Mission Accomplished'}</span>
          <span>{current_step} / {totalSteps} Steps</span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden relative">
          <motion.div 
            className={`h-full ${status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-4 px-2 pb-8">
        <AnimatePresence>
          {plan.map((s, index) => {
            const isCompleted = status === 'completed' || s.step < current_step;
            const isCurrent = s.step === current_step && status === 'executing';
            const isPending = s.step > current_step || status === 'planning';

            return (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start gap-4 p-4 rounded-xl border ${
                  isCurrent ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' :
                  isCompleted ? 'bg-white/5 border-white/10 opacity-70' :
                  'bg-transparent border-transparent opacity-40'
                }`}
              >
                {/* Status Icon */}
                <div className="shrink-0 mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-white/30" />
                  )}
                </div>

                {/* Step Details */}
                <div className="flex flex-col flex-grow">
                  <span className={`font-semibold ${
                    isCurrent ? 'text-blue-300' :
                    isCompleted ? 'text-white' :
                    'text-white/50'
                  }`}>
                    {s.step}. {s.desc}
                  </span>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60 tracking-wider">
                      {s.tool}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
};
