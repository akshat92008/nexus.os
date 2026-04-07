'use client';

import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';
import { useEffect } from 'react';
import { 
  Flame, 
  Inbox, 
  Activity, 
  CheckCircle, 
  Clock, 
  Zap, 
  Target, 
  TrendingUp, 
  BookOpen, 
  GraduationCap,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  Bot,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';
import { UniversalCommandBar } from './UniversalCommandBar';

export function DashboardView() {
  const workspaces = useNexusStore((s) => s.workspaces);
  const ongoingMissions = useNexusStore((s) => s.ongoingMissions);
  const setActiveWorkspace = useNexusStore((s) => s.setActiveWorkspace);
  const completeAction = useNexusStore((s) => s.completeNextAction);
  const finances = useNexusStore((s) => s.finances);
  const calendar = useNexusStore((s) => s.calendar);
  const timeTracking = useNexusStore((s) => s.timeTracking);
  const invoicing = useNexusStore((s) => s.invoicing);
  const brainStats = useNexusStore((s) => s.brainStats);
  const fetchBrainStats = useNexusStore((s) => s.fetchBrainStats);
  const neuralInterrupts = useNexusStore((s) => s.neuralInterrupts);
  const globalRisks = useNexusStore((s) => s.globalRisks);
  const globalOpportunities = useNexusStore((s) => s.globalOpportunities);
  const clearInterrupt = useNexusStore((s) => s.clearInterrupt);
  const spawnAgent = useNexusStore((s) => s.spawnAgent);

  useEffect(() => {
    fetchBrainStats();
    const interval = setInterval(fetchBrainStats, 30000);
    return () => clearInterval(interval);
  }, [fetchBrainStats]);
  
  const { 
    toggleFinancialView, 
    toggleTimeTrackingView, 
    toggleInvoicingView, 
    toggleCalendarView 
  } = useNexusStore();

  const { currentMode } = useModeStore();

  const isStudent = currentMode === 'student';

  // Aggregate global next actions
  const allActions = Object.values(workspaces || {}).flatMap((ws) => 
    (ws?.nextActions || []).map(action => ({ ...action, workspaceId: ws.id, goal: ws.goal }))
  ).sort((a, b) => {
    const w: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const priorityA = a.priority || 'low';
    const priorityB = b.priority || 'low';
    return (w[priorityB] || 0) - (w[priorityA] || 0);
  });

  const activeOngoing = Object.values(ongoingMissions || {}).filter(m => m?.status === 'active');
  const recentWorkspaces = Object.values(workspaces || {}).sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0)).slice(0, 5);

  // Stats
  const totalCompletedTasks = Object.values(workspaces || {}).reduce((sum, ws) => {
    return sum + (ws?.sections || []).reduce((s2, sec) => {
      if (sec.type === 'tasklist') {
        return s2 + (sec.content as any[] || []).filter((t: any) => t?.status === 'done').length;
      }
      return s2;
    }, 0);
  }, 0);

  if (isStudent) {
    const latestAction = allActions[0];
    const displayTopics = recentWorkspaces.slice(0, 3);
    const displayTasks = allActions.slice(0, 2);

    return (
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col gap-10 pb-20 pt-8 fade-in">
        
        {/* Student Branding */}
        <div className="flex items-start justify-between bg-zinc-900/40 p-10 rounded-[32px] border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
               <GraduationCap size={20} className="text-violet-400" />
               <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Academic Assistant</span>
            </div>
            <h2 className="text-5xl font-black tracking-tight text-white mb-4">Good Morning.</h2>
            <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
              Your learning materials are ready. Pick up where you left off or start a new topic.
            </p>

            <div className="flex gap-4 mt-8">
              <button 
                disabled={displayTopics.length === 0}
                onClick={() => displayTopics[0] && setActiveWorkspace(displayTopics[0].id)}
                className={`px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-xl active:scale-95 flex items-center gap-2 ${
                  displayTopics.length > 0 
                    ? 'bg-white text-zinc-950 hover:scale-105 shadow-white/5' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                }`}
              >
                Continue Work
                <ChevronRight size={18} />
              </button>
              <button 
                onClick={() => {
                  useNexusStore.getState().toggleDashboard();
                  useNexusStore.getState().resetWorkspace();
                  useNexusStore.getState().setCommandBarFocused(true);
                }}
                className="px-8 py-4 rounded-2xl bg-zinc-800/50 text-zinc-300 font-bold text-base border border-zinc-700/50 hover:bg-zinc-800 transition-all active:scale-95"
              >
                Start New Topic
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Recent Topics */}
           <section className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                 <BookOpen size={16} /> Recent Topics
              </h3>
              <div className="flex flex-col gap-4">
                 {displayTopics.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-zinc-800 border-dashed text-zinc-600 text-sm italic">
                       No recent topics yet. Start by asking anything in the box above.
                    </div>
                 ) : (
                    displayTopics.map(ws => (
                       <div key={ws.id} onClick={() => setActiveWorkspace(ws.id)} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/60 transition-all cursor-pointer group">
                          <h4 className="font-bold text-zinc-200 group-hover:text-violet-400 transition-colors">{ws.goal}</h4>
                          <span className="text-xs text-zinc-500 mt-1 block">Last viewed {new Date(ws.createdAt).toLocaleDateString()}</span>
                       </div>
                    ))
                 )}
              </div>
           </section>

           {/* Suggested Next Task */}
           <section className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                 <Target size={16} /> Suggested Next Task
              </h3>
              <div className="flex flex-col gap-4">
                 {displayTasks.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-zinc-800 border-dashed text-zinc-600 text-sm italic">
                       No pending tasks. You're all caught up!
                    </div>
                 ) : (
                    displayTasks.map(task => (
                       <div key={task.id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 group relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
                          <h4 className="font-bold text-zinc-200 text-sm">{task.title}</h4>
                          <p className="text-xs text-zinc-500 mt-2">Topic: {task.goal}</p>
                          <button 
                             onClick={() => completeAction(task.workspaceId, task.id)}
                             className="mt-4 w-full py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"
                          >
                             Mark as Done
                          </button>
                       </div>
                    ))
                 )}
              </div>
           </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-12 pb-24 pt-6 fade-in text-zinc-100">
      
      {/* 🚀 NEURAL HUD: Proactive Brain Alerts */}
      {neuralInterrupts.length > 0 && (
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
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 transition-all opacity-0 group-hover:opacity-100"
                >
                  Dismiss
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* 1. Brand Header / Command Center HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gradient-to-br from-zinc-900/40 to-zinc-950/60 p-10 rounded-[40px] border border-zinc-800/60 backdrop-blur-3xl relative overflow-hidden flex flex-col justify-between min-h-[340px]">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-600/10 blur-[150px] rounded-full pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-6">
               <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Master Brain V2.0 Online</span>
            </div>
            <h2 className="text-6xl font-black tracking-tighter text-white mb-4">Command Center</h2>
            <p className="text-lg text-zinc-400 max-w-lg leading-relaxed font-medium">
              Autonomous reflection cycle complete. {globalOpportunities.length} new insights detected.
            </p>
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              onClick={() => recentWorkspaces[0] && setActiveWorkspace(recentWorkspaces[0].id)}
              className="px-8 py-4 rounded-2xl bg-white text-zinc-950 font-black text-sm hover:scale-[1.03] transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              Resume Critical Mission
            </button>
            <button 
              onClick={() => {
                useNexusStore.getState().toggleDashboard();
                useNexusStore.getState().resetWorkspace();
                useNexusStore.getState().setCommandBarFocused(true);
              }}
              className="px-8 py-4 rounded-2xl bg-zinc-800/40 text-zinc-300 font-bold text-sm border border-zinc-700/50 hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
            >
              Issue Direct Order
            </button>
          </div>
        </div>

        <div className="grid grid-rows-2 gap-6">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-[40px] p-8 flex flex-col items-center justify-center text-center backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <Activity size={24} className="text-violet-400" />
            </div>
            <span className="text-4xl font-black text-white">{brainStats.activeMissions}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">Active Streams</span>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-[40px] p-8 flex flex-col items-center justify-center text-center backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <CheckCircle size={24} className="text-cyan-400" />
            </div>
            <span className="text-4xl font-black text-white">{brainStats.totalMissions}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-2">Closed Objectives</span>
          </div>
        </div>
      </div>

      {/* 🔮 STRATEGIC INTELLIGENCE: Risks & Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ALPHA OPPORTUNITIES */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 px-2">
            <div className="flex items-center gap-3 text-cyan-400">
               <Zap size={18} className="fill-cyan-400/20" />
               <h3 className="text-xs font-black uppercase tracking-[0.2em]">Alpha Opportunities</h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded">Decision Quality: High</span>
          </div>
          
          <div className="grid gap-4">
            {globalOpportunities.length === 0 ? (
              <div className="p-8 rounded-3xl border border-zinc-800 border-dashed text-center text-zinc-600 italic text-sm bg-zinc-900/10">
                Next reflection cycle in progress...
              </div>
            ) : (
              globalOpportunities.map((opp: any) => (
                <div key={opp.id} className="group p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/60 hover:border-cyan-500/30 hover:bg-zinc-900/40 transition-all cursor-pointer relative overflow-hidden">
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-cyan-500/30 group-hover:bg-cyan-500 transition-all" />
                  <h4 className="font-bold text-zinc-100 group-hover:text-cyan-400 transition-colors mb-2">{opp.title}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-4">{opp.description}</p>
                  <button className="text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-300 transition-colors">Capitalize Intelligence →</button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* STRATEGIC RISKS */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 px-2">
            <div className="flex items-center gap-3 text-rose-500">
               <Flame size={18} className="fill-rose-500/20" />
               <h3 className="text-xs font-black uppercase tracking-[0.2em]">Strategic Risks</h3>
            </div>
            <span className="text-[10px] font-bold text-rose-500/60 bg-rose-500/5 px-2 py-1 rounded">OS Integrity: 98%</span>
          </div>
          
          <div className="grid gap-4">
            {globalRisks.length === 0 ? (
              <div className="p-8 rounded-3xl border border-zinc-800 border-dashed text-center text-zinc-600 italic text-sm bg-zinc-900/10">
                No critical threats detected.
              </div>
            ) : (
              globalRisks.map((risk: any) => (
                <div key={risk.id} className="p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/60 hover:border-rose-500/30 transition-all relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/30" />
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-zinc-100">{risk.title}</h4>
                    <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">{risk.severity}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-4">{risk.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {(risk.mitigations || []).map((m: string, i: number) => (
                      <span key={i} className="text-[9px] font-bold text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-700/30">{m}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 🦾 UNIT DEPLOYMENT: Autonomous Agent Spawning */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-violet-400 border-b border-zinc-800/80 pb-4 px-2">
           <Bot size={18} className="fill-violet-400/20" />
           <h3 className="text-xs font-black uppercase tracking-[0.2em]">Unit Deployment Center</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { type: 'researcher', icon: <BookOpen />, label: 'Deep Research', color: 'violet' },
             { type: 'analyst', icon: <TrendingUp />, label: 'Strategic Analysis', color: 'cyan' },
             { type: 'code_architect', icon: <Activity />, label: 'Code Engineering', color: 'emerald' },
             { type: 'summarizer', icon: <Inbox />, label: 'Data Synthesis', color: 'amber' }
           ].map(unit => (
             <button 
              key={unit.type}
              onClick={() => spawnAgent(unit.type as any)}
              className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-800/40 transition-all flex flex-col items-center gap-4 text-center group"
             >
                <div className={`w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                   {unit.icon}
                </div>
                <div>
                   <div className="text-sm font-black text-zinc-200">{unit.label}</div>
                   <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Deploy Unit</div>
                </div>
             </button>
           ))}
        </div>
      </section>

    </div>
  );
}
