import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore, ScheduleConfigUI } from '../../store/nexusStore';
import { Clock, Calendar, Zap, X, ChevronRight, Check } from 'lucide-react';
import { API_BASE } from '../../hooks/useNexusSSE';

interface SchedulerPanelProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SchedulerPanel({ workspaceId, isOpen, onClose }: SchedulerPanelProps) {
  const { session, workspaces, upsertSchedule } = useNexusStore();
  const [selectedFreq, setSelectedFreq] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSchedule = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          goal: workspaces[workspaceId]?.goal || session.goal || 'Ongoing Background Mission',
          userId: session.userId,
          frequency: selectedFreq,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create schedule (${response.status})`);
      }

      const payload = await response.json() as { schedule: ScheduleConfigUI };
      upsertSchedule(payload.schedule);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const frequencies = [
    { id: 'hourly', label: 'Hourly', icon: Zap, desc: 'High-frequency monitoring' },
    { id: 'daily', label: 'Daily', icon: Clock, desc: 'End-of-day intelligence digest' },
    { id: 'weekly', label: 'Weekly', icon: Calendar, desc: 'Monday morning strategic brief' },
  ] as const;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-[#070514]/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-[#120F24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  Continuous Execution
                  <span className="text-[10px] font-bold tracking-wider uppercase bg-violet-500 text-white px-1.5 py-0.5 rounded-[4px]">Beta</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Automate this workspace</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-300">
              Transform this workspace into a persistent agent that runs automatically and alerts you to actionable insights.
            </p>

            <div className="space-y-2 mt-4">
              {frequencies.map((f) => {
                const isSelected = selectedFreq === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFreq(f.id)}
                    className={`w-full flex items-center p-4 rounded-xl border transition-all text-left group ${
                      isSelected 
                        ? 'bg-violet-500/10 border-violet-500/30' 
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`p-2 rounded-lg mr-4 transition-colors ${
                      isSelected ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'
                    }`}>
                      <f.icon size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{f.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{f.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-600'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/5 bg-[#0A0815] flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSchedule}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Optimizing Engine...' : 'Enable Autopilot'}
              {!isSubmitting && <ChevronRight size={16} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
