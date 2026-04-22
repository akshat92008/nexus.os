'use client';

import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';
import { useEffect } from 'react';
import { 
  Activity, 
  CheckCircle, 
  Target, 
  TrendingUp, 
  BookOpen, 
  Inbox,
  Bot
} from 'lucide-react';
import { StudentDashboard } from './StudentDashboard';
import { NeuralHUD } from './NeuralHUD';
import { StrategicIntelligence } from './StrategicIntelligence';

export function DashboardView() {
  const workspaces = useNexusStore((s) => s.workspaces);
  const setActiveWorkspace = useNexusStore((s) => s.setActiveWorkspace);
  const brainStats = useNexusStore((s) => s.brainStats);
  const fetchBrainStats = useNexusStore((s) => s.fetchBrainStats);
  const globalOpportunities = useNexusStore((s) => s.globalOpportunities);
  const spawnAgent = useNexusStore((s) => s.spawnAgent);

  useEffect(() => {
    fetchBrainStats();
    const interval = setInterval(fetchBrainStats, 30000);
    return () => clearInterval(interval);
  }, [fetchBrainStats]);
  
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

  const recentWorkspaces = Object.values(workspaces || {}).sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0)).slice(0, 5);

  if (isStudent) {
    const displayTopics = recentWorkspaces.slice(0, 3);
    const displayTasks = allActions.slice(0, 2);
    return <StudentDashboard displayTopics={displayTopics} displayTasks={displayTasks} />;
  }

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-12 pb-24 pt-6 fade-in text-zinc-100">
      
      {/* 🚀 NEURAL HUD: Proactive Brain Alerts */}
      <NeuralHUD />

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
      <StrategicIntelligence />

      {/* 🦾 UNIT DEPLOYMENT: Autonomous Agent Spawning */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-violet-400 border-b border-zinc-800/80 pb-4 px-2">
           <Bot size={18} className="fill-violet-400/20" />
           <h3 className="text-xs font-black uppercase tracking-[0.2em]">Unit Deployment Center</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { type: 'researcher', icon: <BookOpen />, label: 'Deep Research' },
             { type: 'analyst', icon: <TrendingUp />, label: 'Strategic Analysis' },
             { type: 'code_architect', icon: <Activity />, label: 'Code Engineering' },
             { type: 'summarizer', icon: <Inbox />, label: 'Data Synthesis' }
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
