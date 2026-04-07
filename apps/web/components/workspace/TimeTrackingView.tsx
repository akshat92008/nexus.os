'use client';

import { useNexusStore } from '../../store/nexusStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Square, Trash2, Calendar, History, BarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TimeTrackingView() {
  const { timeTracking, startTimeEntry, stopTimeEntry, deleteTimeEntry } = useNexusStore();
  const [activeDuration, setActiveDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeTracking.activeEntry) {
      interval = setInterval(() => {
        setActiveDuration(Date.now() - timeTracking.activeEntry!.startTime);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeTracking.activeEntry]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col gap-8 pb-20 fade-in pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Time Tracking</h1>
          <p className="text-zinc-500 mt-1">Monitor your productivity and billable hours.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700 flex items-center gap-2">
            <BarChart2 size={16} /> Reports
          </button>
        </div>
      </div>

      {/* Active Timer */}
      <div className={`p-8 rounded-[32px] border ${timeTracking.activeEntry ? 'border-violet-500/50 bg-violet-600/10' : 'border-zinc-800 bg-zinc-900/40'} backdrop-blur-md relative overflow-hidden transition-all duration-500`}>
        {timeTracking.activeEntry && (
          <div className="absolute top-0 left-0 h-1 bg-violet-500 animate-pulse w-full" />
        )}
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            {timeTracking.activeEntry ? (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-black text-violet-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                  Currently Tracking
                </div>
                <h2 className="text-2xl font-bold text-zinc-100">{timeTracking.activeEntry.label}</h2>
                <div className="text-sm text-zinc-500 mt-1">Started at {new Date(timeTracking.activeEntry.startTime).toLocaleTimeString()}</div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-2">Ready to start?</div>
                <h2 className="text-2xl font-bold text-zinc-400 italic">No active timer...</h2>
              </div>
            )}
          </div>

          <div className="flex items-center gap-8">
            <div className={`text-6xl font-black tabular-nums tracking-tighter ${timeTracking.activeEntry ? 'text-white' : 'text-zinc-700'}`}>
              {timeTracking.activeEntry ? formatDuration(activeDuration) : '00:00:00'}
            </div>
            
            {timeTracking.activeEntry ? (
              <button 
                onClick={() => stopTimeEntry()}
                className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-rose-600/20"
              >
                <Square size={24} fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={() => startTimeEntry('manual', 'Manual Task')}
                className="w-16 h-16 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-500 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-violet-600/20"
              >
                <Play size={24} fill="currentColor" className="ml-1" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent History */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <History size={16} /> Recent History
        </h3>
        
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {timeTracking.recentEntries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-between group hover:bg-zinc-900/60 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-zinc-800 text-zinc-500 group-hover:text-violet-400 transition-colors">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-200">{entry.label}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-zinc-500 flex items-center gap-1 uppercase tracking-widest font-bold">
                        <Calendar size={10} /> {new Date(entry.endTime).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-bold">•</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        Workspace: {entry.workspaceId}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-xl font-bold text-zinc-100 tabular-nums">
                    {formatDuration(entry.durationMs)}
                  </div>
                  <button 
                    onClick={() => deleteTimeEntry(entry.id)}
                    className="p-2 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {timeTracking.recentEntries.length === 0 && (
            <div className="p-12 border border-zinc-800 border-dashed rounded-[32px] text-center bg-zinc-900/20">
              <Clock size={40} className="mx-auto text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-medium">No time entries recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
