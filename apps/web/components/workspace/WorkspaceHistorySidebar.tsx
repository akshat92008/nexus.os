'use client';

import { useNexusStore } from '../../store/nexusStore';
import { 
  Plus, Search, Library, User, Settings, Layout, 
  Trash2, Briefcase, FileText, Zap, Target, Hexagon, Network, Database, BrainCircuit, Code, PenTool, LayoutTemplate, X
} from 'lucide-react';
import { motion } from 'framer-motion';

export function WorkspaceHistorySidebar() {
  const workspaces = useNexusStore(s => s.workspaces);
  const appWindows = useNexusStore(s => s.appWindows);
  const activeId = useNexusStore(s => s.activeWorkspaceId);
  const setActiveWorkspace = useNexusStore(s => s.setActiveWorkspace);
  const deleteWorkspace = useNexusStore(s => s.deleteWorkspace);
  const toggleAppLauncher = useNexusStore(s => s.toggleAppLauncher);
  const toggleAgentsView = useNexusStore(s => s.toggleAgentsView);
  const toggleSearchView = useNexusStore(s => s.toggleSearchView);
  const toggleLibraryView = useNexusStore(s => s.toggleLibraryView);
  const closeWindow = useNexusStore(s => s.closeWindow);

  const entries = Object.values(workspaces).sort((a, b) => b.createdAt - a.createdAt);
  const openApps = Object.values(appWindows).sort((a, b) => b.openedAt - a.openedAt);

  // Helper to resolve mission icons based on windowType
  const getAppIcon = (windowType: string) => {
    switch (windowType) {
      case 'lead_engine': return <Network size={14} className="text-cyan-400" />;
      case 'research_lab': return <Database size={14} className="text-purple-400" />;
      case 'strategy_board': return <BrainCircuit size={14} className="text-teal-400" />;
      case 'code_studio': return <Code size={14} className="text-orange-400" />;
      case 'content_engine': return <PenTool size={14} className="text-pink-400" />;
      default: return <LayoutTemplate size={14} className="text-slate-400" />;
    }
  };

  // Helper to resolve mission icons based on goalType
  const getMissionIcon = (goalType: string) => {
    switch (goalType) {
      case 'lead_gen': return <Target size={14} className="text-emerald-400" />;
      case 'research': return <Search size={14} className="text-cyan-400" />;
      case 'strategy': return <Zap size={14} className="text-violet-400" />;
      default: return <FileText size={14} className="text-zinc-500" />;
    }
  };

  return (
    <div className="w-64 border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl shrink-0 h-full flex flex-col z-20 relative">
      
      {/* 1. Brand Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hexagon size={16} className="text-white bg-gradient-to-br from-violet-600 to-cyan-600 rounded p-0.5 shadow-[0_0_10px_rgba(139,92,246,0.3)]" />
          <span className="text-sm font-black tracking-tighter text-white uppercase italic">Agentic OS</span>
        </div>
        <button 
          onClick={() => useNexusStore.getState().toggleDashboard()}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 transition-colors"
        >
          <Layout size={14} />
        </button>
      </div>

      {/* 2. Top Actions (Manus Style) */}
      <div className="px-2 pt-2 space-y-0.5">
        <button 
          onClick={toggleAppLauncher}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 font-medium hover:bg-zinc-900 border border-zinc-800/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={14} className="text-zinc-500" />
          Deploy Environment
        </button>
        <button 
          onClick={toggleAgentsView}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 transition-all border border-transparent hover:border-white/5"
        >
          <div className="flex items-center gap-3">
            <User size={14} className="text-zinc-600" />
            Agents
          </div>
          <span className="text-[10px] bg-violet-600/20 text-violet-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">New</span>
        </button>
        <button 
          onClick={toggleSearchView}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 transition-all border border-transparent hover:border-white/5"
        >
          <Search size={14} className="text-zinc-600" />
          Search
        </button>
        <button 
          onClick={toggleLibraryView}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-900 transition-all border border-transparent hover:border-white/5"
        >
          <Library size={14} className="text-zinc-600" />
          Library
        </button>
      </div>

      {/* 3. Open OS Windows */}
      <div className="mt-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Active Windows</h3>
          <span className="text-[10px] bg-violet-600 text-white px-1.5 rounded">{openApps.length}</span>
        </div>
        
        <div className="space-y-1 mt-3">
          {openApps.length === 0 ? (
            <div className="p-3 text-center text-[10px] text-zinc-600 border border-zinc-900/50 rounded-lg border-dashed">
              No windows open.
            </div>
          ) : (
            openApps.map(app => (
              <div
                key={app.workspaceId}
                onClick={() => setActiveWorkspace(app.workspaceId)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border border-transparent ${
                  activeId === app.workspaceId 
                    ? 'bg-zinc-900 border-zinc-800 shadow-sm' 
                    : 'hover:bg-zinc-900/50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  <div className="relative shrink-0 flex items-center justify-center">
                    {app.isBackground && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    {getAppIcon(app.windowType)}
                  </div>
                  <div className="text-xs font-medium truncate text-zinc-300">
                    {app.title}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); closeWindow(app.workspaceId); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-600 rounded transition-all shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. All Tasks History (Manus Iconic Style) */}
      <div className="mt-6 flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar border-t border-zinc-900 pt-4">
        <div className="px-2 mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">All tasks</h3>
          <Settings size={12} className="text-zinc-600" />
        </div>

        {entries.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-zinc-600 border border-zinc-900/50 rounded-lg border-dashed">No saved tasks yet.</div>
        ) : (
          entries.map(ws => (
            <div
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border-l-2 ${
                activeId === ws.id 
                  ? 'bg-violet-500/10 border-violet-500 shadow-[inset_10px_0_20px_-10px_rgba(139,92,246,0.2)]' 
                  : 'hover:bg-zinc-900/40 border-transparent'
              }`}
            >

              <div className="shrink-0 w-6 h-6 rounded flex items-center justify-center bg-zinc-900 border border-zinc-800/60 group-hover:bg-zinc-800 transition-colors">
                 {getMissionIcon(ws.goalType)}
              </div>
              <div className="overflow-hidden flex-1">
                <div className={`text-[13px] truncate pr-2 ${activeId === ws.id ? 'font-medium text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                  {ws.goal}
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-600 rounded transition-all shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 5. Sidebar Footer */}
      <div className="p-4 border-t border-zinc-800/80">
         <div className="flex items-center justify-between text-[10px] text-zinc-600 font-medium">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
               Agentic OS v2.0
            </div>
            <div className="flex items-center gap-1 opacity-50">
               Founder Edition
            </div>
         </div>
      </div>
    </div>
  );
}
