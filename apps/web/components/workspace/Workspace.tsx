'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelRightOpen,
  PanelRightClose,
  LayoutDashboard,
  Hexagon,
  User,
  AlertCircle,
  Circle,
  X as CloseIcon,
  FileSpreadsheet,
  Download,
  FileText,
  Bell,
  ChevronDown,
  Zap,
  Activity,
  Clock
} from 'lucide-react';


import { UniversalCommandBar }  from './UniversalCommandBar';
import { SandboxRouter }        from './SandboxRouter';
import { ArtifactViewer }       from './ArtifactViewer';
import { OmniChatView }          from './OmniChatView';
import { WorkspaceHistorySidebar } from './WorkspaceHistorySidebar';
import { WorkspaceCanvas }         from './WorkspaceCanvas';
import { DashboardView }           from './DashboardView';
import { NextActionPanel }         from './NextActionPanel';
import { ActivityTimeline }        from './ActivityTimeline';
import { AppLauncher }             from './AppLauncher';
import { SchedulerPanel }          from './SchedulerPanel';
import { UnifiedInbox }           from './UnifiedInbox';
import { AgentsView }              from './AgentsView';
import { SearchView }              from './SearchView';
import { FileSystemView }          from './FileSystemView';
import { AgentMarketplace }        from '../market/AgentMarketplace';
import { FinancialView }           from './FinancialView';
import { TimeTrackingView }        from './TimeTrackingView';
import { InvoicingView }           from './InvoicingView';
import { CalendarView }            from './CalendarView';
import { GraphCanvas }             from './GraphCanvas';
import { ApprovalModal }           from './ApprovalModal';
import { exportArtifact }          from '../../lib/exportArtifact';
import type { ExportFormat }       from '@nexus-os/types';

import { useModeStore } from '../../store/modeStore';
import {
  useNexusStore,
  selectParallelAgents,
  selectSequentialAgents,
  selectIsRunning,
} from '../../store/nexusStore';

function StatusDot({ status }: { status: string }) {
  const isRunning = status === 'running' || status === 'routing';
  if (isRunning) {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
      </span>
    );
  }
  if (status === 'complete') return <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>;
  if (status === 'error') return <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>;
  return <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-600"></span>;
}

function PlanOverview() {
  const parallel   = useNexusStore(selectParallelAgents);
  const sequential = useNexusStore(selectSequentialAgents);
  const session    = useNexusStore((s) => s.session);
  const { currentMode } = useModeStore();

  const isStudent = currentMode === 'student';

  if (!session.goal || session.status === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="p-[1px] rounded-3xl bg-gradient-to-br from-violet-500/20 via-zinc-800/40 to-cyan-500/20 shadow-2xl relative overflow-hidden"
    >
      <div className="bg-zinc-950/80 backdrop-blur-3xl p-8 rounded-[23px] relative z-10">
        <div className="flex items-center gap-3 mb-6">
           <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20">
              <Hexagon size={18} className="text-violet-400" />
           </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-0.5">
                 {currentMode === 'founder' ? 'Founders Objective' : currentMode === 'developer' ? 'Engineering Goal' : 'Study Goal'}
              </div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                 Status: <span className="text-violet-400 capitalize">
                    {session.status === 'running' ? (
                      <>
                        {currentMode === 'founder' ? 'Executing mission...' : currentMode === 'developer' ? 'Coding & Verifying...' : 'Learning and summarizing...'}
                        {session.systemPauseUntil && (
                          <span className="ml-2 text-[10px] text-rose-400 animate-pulse lowercase font-normal">
                            (API Paused: {Math.max(0, Math.round((session.systemPauseUntil - Date.now()) / 1000))}s)
                          </span>
                        )}
                      </>
                    ) : session.status}
                 </span>
              </div>
           </div>
        </div>

        <h2 className="text-2xl font-bold text-zinc-100 leading-[1.4] mb-8 max-w-4xl tracking-tight">
           {session.goal}
        </h2>

        {(parallel.length > 0 || sequential.length > 0) && !isStudent && (
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-zinc-800/60">
            {parallel.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                   <Zap size={14} className="text-cyan-400 group-hover:animate-pulse" />
                   <span className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-black">Parallel Recruitment</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parallel.map((a) => (
                    <div key={a.taskId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/50 text-[11px] text-zinc-400 font-medium transition-all hover:border-cyan-500/30">
                      <Circle size={6} className={a.status === 'complete' ? 'text-emerald-400 fill-emerald-400/20 shadow-[0_0_8px_rgba(52,211,153,0.3)]' : a.status === 'working' ? 'text-cyan-400 fill-cyan-400/20 animate-pulse' : 'text-zinc-600'} />
                      {a.taskLabel}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sequential.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 group">
                   <Activity size={14} className="text-violet-400 group-hover:animate-pulse" />
                   <span className="text-[10px] uppercase tracking-widest text-violet-400/80 font-black">Chain Sequencing</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sequential.map((a) => (
                    <div key={a.taskId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/50 text-[11px] text-zinc-400 font-medium transition-all hover:border-violet-500/30">
                      <Circle size={6} className={a.status === 'complete' ? 'text-emerald-400 fill-emerald-400/20 shadow-[0_0_8px_rgba(52,211,153,0.3)]' : a.status === 'working' ? 'text-violet-400 fill-violet-400/20 animate-pulse' : 'text-zinc-600'} />
                      {a.taskLabel}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isStudent && session.status === 'running' && (
           <div className="pt-6 border-t border-zinc-800/60 flex items-center gap-3">
              <div className="flex -space-x-2">
                 {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-950 bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-[10px] font-bold">
                       A{i}
                    </div>
                 ))}
              </div>
              <span className="text-sm text-zinc-400 font-medium animate-pulse">Agents are gathering and structuring knowledge for you...</span>
           </div>
        )}
      </div>
      
      {/* Subtle Background Glows */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-[60px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-600/5 blur-[60px] rounded-full" />
    </motion.div>
  );
}


export function Workspace() {
  const session       = useNexusStore((s) => s.session);
  const isRunning     = useNexusStore(selectIsRunning);
  const sidebarOpen   = useNexusStore((s) => s.ui.sidebarExpanded);
  const toggleSidebar = useNexusStore((s) => s.toggleSidebar);
  const hydrateFromServer = useNexusStore((s) => s.hydrateFromServer);
  const activeWorkspaceId = useNexusStore((s) => s.activeWorkspaceId);
  const toasts            = useNexusStore((s) => s.toasts);
  const removeToast       = useNexusStore((s) => s.removeToast);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  
  const { 
    ui, 
    workspaces,
    toggleInbox, 
    toggleDashboard,
    setActiveWorkspace,
  } = useNexusStore();

  const inboxOpen = ui.inboxOpen;

  useEffect(() => {
    const userId = localStorage.getItem('nexus_user_id') ?? `user_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('nexus_user_id', userId);
    useNexusStore.getState().setUserId(userId);
    void hydrateFromServer(userId);
  }, [hydrateFromServer]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0F1115] text-zinc-100 font-sans relative selection:bg-violet-500/30">
      
      {/* 🌌 DEEP SPACE BACKGROUND: Gradient + Dot Matrix */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1115] via-black to-[#0F1115]" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/5 blur-[150px] rounded-full animate-pulse" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* 🚀 ZONE A: OMNI-BAR (Floating Centerpiece) */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-6">
        <UniversalCommandBar />
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10 w-full">
        
        {/* 🔹 ZONE B: EXECUTION CANVAS (Left - 30%) */}
        <aside className="w-[30%] min-w-[340px] border-r border-white/5 bg-black/20 backdrop-blur-3xl flex flex-col pt-24">
          <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Zap size={14} className="text-violet-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Execution Canvas</h3>
             </div>
             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400">
                <span className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" /> Live Reasoning
             </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
             <GraphCanvas sessionId={session.id || 'initial'} />
          </div>
        </aside>

        {/* 🔹 ZONE C: INTERACTIVE SANDBOX (Center - 50%) */}
        <main className="flex-1 h-full pt-24 relative overflow-hidden flex flex-col bg-white/[0.01]">
            {/* Minimal Sub-Header / Breadcrumbs for Sandbox */}
            <div className="h-10 px-8 flex items-center gap-4 bg-black/10 border-b border-white/5 shrink-0">
               <div className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/5 cursor-pointer group transition-all">
                  <Hexagon size={12} className="text-zinc-600 group-hover:text-violet-400" />
                  <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase tracking-widest">
                    {activeWorkspaceId ? workspaces[activeWorkspaceId]?.goal : 'System Boot'}
                  </span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
              <SandboxRouter />
            </div>
        </main>

        {/* 🔹 ZONE D: VAULT + ROSTER (Right - 20%) */}
        <aside className="w-[20%] min-w-[280px] border-l border-white/5 bg-black/20 backdrop-blur-3xl flex flex-col pt-24">
           {/* Top: Agent Roster */}
           <div className="h-[45%] flex flex-col border-b border-white/5 overflow-hidden">
              <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center gap-2">
                 <Activity size={14} className="text-cyan-400" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Agent Roster</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                 <AgentsView />
              </div>
           </div>

           {/* Bottom: Semantic Vault */}
           <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center gap-2">
                 <Clock size={14} className="text-zinc-500" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Semantic Vault</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                 <ActivityTimeline />
              </div>
           </div>
        </aside>
      </div>

      {/* 🍞 TOAST SYSTEM (Bottom Left) */}
      <div className="fixed bottom-8 left-8 z-[300] flex flex-col gap-3 pointer-events-none w-full max-w-md">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      {/* 🧪 SYSTEM OVERLAYS */}
      <AppLauncher />
      <UnifiedInbox isOpen={inboxOpen} onClose={toggleInbox} />
      <FileSystemView />
      <ApprovalModal />

    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: any; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20, scale: 0.9 }} 
      animate={{ opacity: 1, x: 0, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }} 
      className="pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-3xl bg-zinc-950 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
    >
      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
         <AlertCircle size={18} className="text-rose-500" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold text-zinc-100 truncate block">
          {toast.message}
          {toast.count > 1 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-black uppercase text-white">
              x{toast.count}
            </span>
          )}
        </span>
      </div>
      <button 
        onClick={() => onRemove(toast.id)} 
        className="p-1 px-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-500 hover:text-zinc-200"
      >
        <CloseIcon size={14} />
      </button>
    </motion.div>
  );
}
