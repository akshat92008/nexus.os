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
  const resetWS       = useNexusStore((s) => s.resetWorkspace);
  const hydrateFromServer = useNexusStore((s) => s.hydrateFromServer);
  const activeWorkspaceId = useNexusStore((s) => s.activeWorkspaceId);
  const toasts            = useNexusStore((s) => s.toasts);
  const removeToast       = useNexusStore((s) => s.removeToast);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  
  const { 
    ui, 
    workspaces,
    appWindows,
    toggleInbox, 
    toggleAgentsView, 
    toggleAppLauncher, 
    toggleLibraryView,
    toggleSearchView,
    toggleDashboard,
    toggleGraphView,
    setActiveWorkspace,
    closeWindow
  } = useNexusStore();

  const graphViewOpen = ui.graphViewOpen;
  const inboxOpen = ui.inboxOpen;
  const openWindowList = Object.values(appWindows).sort((a: any, b: any) => b.openedAt - a.openedAt);

  const handleGlobalExport = async (format: ExportFormat) => {
    const sid = activeWorkspaceId || session.id;
    if (!sid) return;
    setExporting(format);
    try { await exportArtifact(sid, format); } catch (err) { useNexusStore.getState().addToast('Export failed.'); } finally { setExporting(null); }
  };

  useEffect(() => {
    const userId = localStorage.getItem('nexus_user_id') ?? `user_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('nexus_user_id', userId);
    useNexusStore.getState().setUserId(userId);
    void hydrateFromServer(userId);
  }, [hydrateFromServer]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-950 text-zinc-100 font-sans relative">
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-md px-6">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      <AppLauncher />
      <AgentsView />
      <AgentMarketplace />
      <UnifiedInbox isOpen={inboxOpen} onClose={toggleInbox} />
      <SearchView />
      <FileSystemView />
      <ApprovalModal />
      {activeWorkspaceId && (
        <SchedulerPanel 
          workspaceId={activeWorkspaceId} 
          isOpen={schedulerOpen} 
          onClose={() => setSchedulerOpen(false)} 
        />
      )}

      {/* Restore Background Dot Matrix Pattern */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      
      {/* Restore Subtle Violet/Cyan Radial Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-900/20 blur-[120px] rounded-full z-0 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-cyan-900/10 blur-[120px] rounded-full z-0 pointer-events-none" />

      <header className="relative z-10 flex items-center gap-4 px-6 py-4 border-b border-zinc-800/40 bg-zinc-950/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div 
            onClick={toggleDashboard}
            title="Home / Morning Brief"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-600/80 to-cyan-600/80 shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-violet-500/30 cursor-pointer hover:scale-110 active:scale-95 transition-all group"
          >
            <Hexagon size={16} className="text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors cursor-pointer text-sm font-bold tracking-tight text-zinc-100">
             Agentic OS v2.0 <ChevronDown size={14} className="text-zinc-600" />
          </div>
        </div>

        {/* Workspace Taskbar / Tab Bar */}
        <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto pl-4 no-scrollbar">
          {openWindowList.map(app => (
             <div 
               key={app.workspaceId}
               onClick={() => setActiveWorkspace(app.workspaceId)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-all ${
                 activeWorkspaceId === app.workspaceId 
                   ? 'bg-zinc-800 border-zinc-700 text-white shadow-md' 
                   : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-300'
               }`}
             >
               <span className="truncate max-w-[150px]">{app.title}</span>
               <button 
                 onClick={(e) => { e.stopPropagation(); closeWindow(app.workspaceId); }}
                 className="p-0.5 rounded-full hover:bg-zinc-700 hover:text-white transition-colors"
               >
                 <CloseIcon size={12} />
               </button>
             </div>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {(session.status === 'complete' || activeWorkspaceId) && (
            <div className="flex items-center gap-2 border-r border-zinc-800 pr-4">
              <button onClick={() => handleGlobalExport('excel')} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 group relative">
                 <FileSpreadsheet size={16} className="transition-transform group-active:scale-95" />
              </button>
              <button onClick={() => handleGlobalExport('pdf')} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-violet-400 group relative">
                 <Download size={16} className="transition-transform group-active:scale-95" />
              </button>
            </div>
          )}
          {activeWorkspaceId && (
            <button onClick={() => setSchedulerOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors pointer shadow-[0_0_10px_rgba(139,92,246,0.15)] text-xs font-bold uppercase tracking-wider">
               <Clock size={14} /> Schedule
            </button>
          )}
          {session.status !== 'idle' && (
            <button 
              onClick={toggleGraphView}
              className={`p-2 rounded-lg transition-colors ${graphViewOpen ? 'bg-violet-600/10 text-violet-400 border border-violet-500/30' : 'text-zinc-500 hover:text-zinc-200'}`}
              title="Reasoning Graph"
            >
              <Zap size={18} />
            </button>
          )}
          <button 
            onClick={toggleInbox}
            className={`p-2 rounded-lg transition-colors ${inboxOpen ? 'bg-violet-600/10 text-violet-400' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-[11px] font-bold text-white shadow-lg shadow-violet-600/20">300</div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-xs text-violet-400 shadow-inner">U</div>
        </div>
      </header>


      <div className="flex flex-1 overflow-hidden relative z-10 w-full">
        <WorkspaceHistorySidebar />
        <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto w-full mx-auto custom-scrollbar">
          {ui.dashboardOpen ? (
            <DashboardView key="dashboard" />
          ) : ui.agentsViewOpen ? (
            <AgentMarketplace key="market" />
          ) : ui.searchViewOpen ? (
            <SearchView key="search" />
          ) : ui.libraryViewOpen ? (
            <div key="library" className="flex items-center justify-center h-full text-zinc-500 text-sm font-bold tracking-widest uppercase italic">Library Experience — 0% Loaded</div>
          ) : (!activeWorkspaceId || !workspaces[activeWorkspaceId]) ? (
            <OmniChatView key="omni" />
          ) : ui.financialViewOpen ? (
            <FinancialView key="finance" />
          ) : (
            <WorkspaceCanvas key={activeWorkspaceId} />
          )}
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside initial={{ width: 0, opacity: 0, x: 20 }} animate={{ width: 380, opacity: 1, x: 0 }} exit={{ width: 0, opacity: 0, x: 20 }} transition={{ type: 'spring', stiffness: 350, damping: 30 }} className="flex flex-col border-l border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl shrink-0 h-full overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/40">
                <div className="flex-1 overflow-hidden border-b border-zinc-800/80">
                  <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-800">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Next Recommended Actions</h3>
                  </div>
                  <div className="h-full overflow-y-auto"><NextActionPanel /></div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-800">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Mission Timeline</h3>
                  </div>
                  <div className="h-full overflow-y-auto"><ActivityTimeline /></div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      
      <button onClick={toggleSidebar} className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-2xl hover:text-white transition-all transform hover:scale-110 active:scale-95">
        {sidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
      </button>
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
      initial={{ opacity: 0, y: 20, scale: 0.9 }} 
      animate={{ opacity: 1, y: 0, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }} 
      className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-500 text-white shadow-2xl border border-rose-400/50 backdrop-blur-md"
    >
      <AlertCircle size={18} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold truncate block">
          {toast.message}
          {toast.count > 1 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase">
              x{toast.count}
            </span>
          )}
        </span>
      </div>
      <button 
        onClick={() => onRemove(toast.id)} 
        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
      >
        <CloseIcon size={14} />
      </button>
    </motion.div>
  );
}
