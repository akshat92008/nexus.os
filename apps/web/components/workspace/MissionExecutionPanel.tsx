'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Activity, CheckCircle, AlertCircle, Terminal, Zap, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';

interface Mission {
  id: string;
  goal: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  created_at: string;
  progress?: number;
}

interface StreamEvent {
  type: string;
  taskId?: string;
  status?: string;
  message?: string;
  timestamp?: number;
  output?: string;
  error?: string;
}

export function MissionExecutionPanel() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = useNexusStore((s) => s.session.userId);

  // Fetch missions
  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions');
      if (!res.ok) return;
      const data = await res.json();
      setMissions(data.missions || []);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 5000);
    return () => clearInterval(interval);
  }, [fetchMissions]);

  // Connect to SSE when mission selected
  useEffect(() => {
    if (!selectedMissionId) {
      eventSourceRef.current?.close();
      return;
    }

    setEvents([]);
    const es = new EventSource(`/api/missions/${selectedMissionId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents((prev) => [...prev, data]);
      } catch {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [selectedMissionId]);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const startMission = async () => {
    if (!goalInput.trim() || !userId) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalInput, archMode: 'os' }),
      });
      const data = await res.json();
      if (data.missionId) {
        setSelectedMissionId(data.missionId);
        setGoalInput('');
        await fetchMissions();
      }
    } catch (e) {
      console.error('[MissionPanel] Start failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const abortMission = async (id: string) => {
    try {
      await fetch(`/api/missions/${id}/abort`, { method: 'POST' });
      await fetchMissions();
    } catch (e) {}
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 size={14} className="text-emerald-400 animate-spin" />;
      case 'queued': return <Clock size={14} className="text-amber-400" />;
      case 'completed': return <CheckCircle size={14} className="text-emerald-500" />;
      case 'failed': return <AlertCircle size={14} className="text-rose-500" />;
      case 'aborted': return <Square size={14} className="text-zinc-500" />;
      default: return <Activity size={14} className="text-zinc-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'queued': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'completed': return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
      case 'failed': return 'text-rose-500 border-rose-500/20 bg-rose-500/5';
      case 'aborted': return 'text-zinc-500 border-zinc-500/20 bg-zinc-500/5';
      default: return 'text-zinc-400 border-white/5 bg-white/[0.02]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between bg-white/[0.03] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <Zap size={14} className="text-violet-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-black text-zinc-500">Mission Control</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-zinc-600">{missions.length} Total</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Mission List */}
        <div className="w-80 border-r border-white/5 flex flex-col">
          {/* New Mission Input */}
          <div className="p-4 border-b border-white/5">
            <textarea
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startMission();
                }
              }}
              placeholder="Enter mission goal..."
              className="w-full h-20 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-700 resize-none focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={startMission}
              disabled={isLoading || !goalInput.trim()}
              className="w-full mt-2 h-8 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs font-bold text-violet-400 uppercase tracking-widest hover:bg-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Launch
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {missions.map((mission) => (
              <button
                key={mission.id}
                onClick={() => setSelectedMissionId(mission.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedMissionId === mission.id
                    ? 'bg-violet-500/10 border-violet-500/30'
                    : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(mission.status)}
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    mission.status === 'running' ? 'text-emerald-400' :
                    mission.status === 'completed' ? 'text-emerald-500' :
                    mission.status === 'failed' ? 'text-rose-500' :
                    'text-zinc-500'
                  }`}>{mission.status}</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">{new Date(mission.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2 leading-snug">{mission.goal}</p>
                {mission.status === 'running' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); abortMission(mission.id); }}
                    className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1"
                  >
                    <Square size={10} /> Abort
                  </button>
                )}
              </button>
            ))}
            {missions.length === 0 && (
              <div className="p-6 text-center">
                <Activity size={24} className="text-zinc-700 mx-auto mb-2" />
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">No missions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Execution Log */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedMissionId ? (
            <>
              <div className="h-10 px-4 flex items-center gap-2 bg-white/[0.02] border-b border-white/5 shrink-0">
                <Terminal size={12} className="text-zinc-500" />
                <span className="text-[10px] font-mono text-zinc-500 truncate">{selectedMissionId.slice(0, 16)}...</span>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px]">
                <AnimatePresence>
                  {events.map((evt, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2"
                    >
                      <span className="text-zinc-700 shrink-0 select-none">{i + 1}</span>
                      <span className={`break-all ${
                        evt.type === 'error' || evt.error ? 'text-rose-400' :
                        evt.type === 'task_complete' ? 'text-emerald-400' :
                        evt.type === 'approval_request' ? 'text-amber-400' :
                        'text-zinc-400'
                      }`}>
                        <span className="text-zinc-600 font-bold">[{evt.type}]</span>{' '}
                        {evt.message || evt.output || evt.error || JSON.stringify(evt).slice(0, 200)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {events.length === 0 && (
                  <div className="h-full flex items-center justify-center text-zinc-700">
                    <div className="text-center">
                      <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                      <p className="text-[10px] uppercase tracking-widest font-bold">Waiting for events...</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-zinc-700">
                <ChevronRight size={32} className="mx-auto mb-2" />
                <p className="text-[10px] uppercase tracking-widest font-bold">Select a mission</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
