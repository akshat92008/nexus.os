'use client';

import { motion } from 'framer-motion';
import { 
  BookOpen, 
  TrendingUp, 
  Briefcase, 
  Calendar, 
  Clock, 
  ChevronRight,
  Target,
  Zap,
  Globe,
  Plus,
  Activity
} from 'lucide-react';
import { useEffect } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function AdaptiveDashboard() {
  const {
    workspaces,
    setActiveWorkspace,
    toggleDashboard,
    toggleSidebar,
    toggleAgentsView,
    toggleLibraryView,
    addInboxEntry,
    brainStats,
    fetchBrainStats
  } = useNexusStore();
  const { currentMode } = useModeStore();

  const workspacesList = Object.values(workspaces).sort((a, b) => b.createdAt - a.createdAt);
  const isStudent = currentMode === 'student';
  const reflection = (brainStats as any).reflection || {};

  useEffect(() => {
    fetchBrainStats();
  }, [fetchBrainStats]);

  const handleShortcut = (label: string) => {
    switch (label) {
      case 'Analytics': 
        toggleDashboard();
        break;
      case 'Schedule':
        addInboxEntry({
          type: 'system',
          title: 'Scheduler Active',
          content: 'The global scheduler is monitoring 3 recurring missions.',
          priority: 'medium'
        });
        break;
      case 'History':
        toggleSidebar();
        break;
      case 'Agents':
        toggleAgentsView();
        break;
    }
  };

  const handleTakeAction = () => {
    addInboxEntry({
      type: 'agent',
      title: 'Action Triggered',
      content: 'I am now executing the suggested optimization script.',
      priority: 'high'
    });
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {/* Primary Context Section */}
      <motion.div variants={item} className="md:col-span-2 space-y-6">
        <div className="p-8 rounded-[32px] bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            {isStudent ? <BookOpen size={120} /> : <Briefcase size={120} />}
          </div>
          
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-[.3em] text-violet-400 mb-4 block">
              {isStudent ? 'Current Semester' : 'Market Pulse'}
            </span>
            <h2 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">
              {isStudent ? 'Your Learning Workspace' : 'Strategic Overview'}
            </h2>
            <p className="text-zinc-400 leading-relaxed max-w-xl mb-8">
              {reflection.overview || (isStudent 
                ? 'Welcome back. You have 3 active research missions and an upcoming exam in Economics. Would you like to resume your last deep-dive?'
                : 'Nexus has identified 12 new high-intent leads in the SaaS sector. Your competitor, Acme Corp, just released a new feature update.')}
            </p>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => workspacesList[0] && setActiveWorkspace(workspacesList[0].id)}
                className="px-6 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm shadow-lg shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                {isStudent ? 'Resume Deep Dive' : 'Review New Leads'}
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={toggleLibraryView}
                className="px-6 py-3 rounded-2xl bg-zinc-800 text-zinc-300 font-bold text-sm border border-zinc-700 hover:bg-zinc-700 transition-all font-bold"
              >
                {isStudent ? 'View Library' : 'Open Strategy Board'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Workspaces / Missions */}
        <div className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Active Missions</h3>
              <button 
                onClick={toggleLibraryView}
                className="text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest flex items-center gap-1"
              >
                 View All <ChevronRight size={12} />
              </button>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {workspacesList.length > 0 ? workspacesList.slice(0, 4).map((ws) => (
                <motion.div 
                  key={ws.id}
                  onClick={() => setActiveWorkspace(ws.id)}
                  whileHover={{ y: -4 }}
                  className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 hover:border-violet-500/50 hover:bg-zinc-900/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-zinc-800 group-hover:bg-violet-600/10 transition-colors">
                      <Zap size={14} className="text-zinc-500 group-hover:text-violet-400" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">
                      {new Date(ws.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-200 line-clamp-1 mb-1 group-hover:text-violet-300 transition-colors">{ws.goal}</h4>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 w-[65%]" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500">65%</span>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-2 p-12 rounded-2xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600">
                  <div className="p-4 rounded-full bg-zinc-900 mb-4">
                    <Plus size={24} />
                  </div>
                  <p className="text-sm font-medium">No active missions. Use the command bar to start.</p>
                </div>
              )}
           </div>
        </div>
      </motion.div>

      {/* Sidebar Context Section */}
      <motion.div variants={item} className="space-y-6">
        {/* Productivity Score / Health */}
        <div className="p-6 rounded-[28px] bg-zinc-900 border border-zinc-800/80 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Productivity</h3>
            <Activity className="text-emerald-500" size={16} />
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-zinc-100 tracking-tighter">{brainStats.totalMissions > 0 ? Math.min(100, 75 + (brainStats.totalMissions * 2)) : 0}</span>
            <span className="text-sm font-bold text-emerald-500 mb-1">+{brainStats.totalMissions}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase">
              <span>Goal Alignment</span>
              <span className="text-zinc-300">{(brainStats as any).reflection?.overview ? 'High' : 'Calculating...'}</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${brainStats.totalMissions > 0 ? Math.min(100, 75 + (brainStats.totalMissions * 2)) : 0}%` }}
                 className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" 
               />
            </div>
          </div>
        </div>

        {/* Proactive Suggestions (Adaptive per context) */}
        <div className="p-6 rounded-[28px] bg-violet-600/5 border border-violet-500/10 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} className="text-violet-400" />
            <h3 className="text-xs font-black text-violet-400/80 uppercase tracking-widest">Proactive Agent</h3>
          </div>
          
          <div className="space-y-4">
            <div 
              onClick={handleTakeAction}
              className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-violet-500/30 transition-all cursor-pointer group"
            >
              <p className="text-xs font-medium text-zinc-300 leading-relaxed mb-3">
                {((brainStats as any).reflection?.risks?.[0]?.title) 
                  ? `Risk Identified: ${(brainStats as any).reflection.risks[0].title}. Shall I develop a mitigation plan?`
                  : (isStudent 
                    ? "I've drafted a study schedule for your Economics final based on your calendar."
                    : "I found a relevant event for your startup in SF next week. Shall I book tickets?")}
              </p>
              <button className="text-[10px] font-bold text-violet-400 uppercase tracking-widest group-hover:text-violet-300 transition-colors">
                Take Action
              </button>
            </div>
            
            <div className="flex items-center gap-3 px-1">
              <Clock size={12} className="text-zinc-600" />
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Suggested 2 mins ago</span>
            </div>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Globe, label: 'Analytics' },
            { icon: Calendar, label: 'Schedule' },
            { icon: Clock, label: 'History' },
            { icon: Zap, label: 'Agents' },
          ].map((s, i) => (
             <button 
               key={i} 
               onClick={() => handleShortcut(s.label)}
               className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800 hover:bg-zinc-800/50 transition-all gap-2 group"
             >
                <s.icon size={18} className="text-zinc-500 group-hover:text-zinc-300" />
                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-tighter">{s.label}</span>
             </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
