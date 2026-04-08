'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Zap, Activity, Clock, AlertCircle, X as CloseIcon } from 'lucide-react';

import dynamic from 'next/dynamic';

const UniversalCommandBar = dynamic(() => import('./UniversalCommandBar').then(mod => mod.UniversalCommandBar), { ssr: false });
const SandboxRouter = dynamic(() => import('./SandboxRouter').then(mod => mod.SandboxRouter), { ssr: false });
const GraphCanvas = dynamic(() => import('./GraphCanvas').then(mod => mod.GraphCanvas), { ssr: false });
const AgentsView = dynamic(() => import('./AgentsView').then(mod => mod.AgentsView), { ssr: false });
const UnifiedInbox = dynamic(() => import('./UnifiedInbox').then(mod => mod.UnifiedInbox), { ssr: false });
const FileSystemView = dynamic(() => import('./FileSystemView').then(mod => mod.FileSystemView), { ssr: false });
const ActivityTimeline = dynamic(() => import('./ActivityTimeline').then(mod => mod.ActivityTimeline), { ssr: false });
const ApprovalModal = dynamic(() => import('./ApprovalModal').then(mod => mod.ApprovalModal), { ssr: false });
const AppLauncher = dynamic(() => import('./AppLauncher').then(mod => mod.AppLauncher), { ssr: false });

import { useNexusStore, selectIsRunning } from '../../store/nexusStore';

export function Workspace() {
  const session = useNexusStore((s) => s.session);
  const isRunning = useNexusStore(selectIsRunning);
  const hydrateFromServer = useNexusStore((s) => s.hydrateFromServer);
  const activeWorkspaceId = useNexusStore((s) => s.activeWorkspaceId);
  const workspaces = useNexusStore((s) => s.workspaces);
  const toasts = useNexusStore((s) => s.toasts);
  const removeToast = useNexusStore((s) => s.removeToast);
  const ui = useNexusStore((s) => s.ui);
  const toggleInbox = useNexusStore((s) => s.toggleInbox);

  useEffect(() => {
    const userId = localStorage.getItem('nexus_user_id') ?? `user_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('nexus_user_id', userId);
    useNexusStore.getState().setUserId(userId);
    void hydrateFromServer(userId);
  }, [hydrateFromServer]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0F1115] text-zinc-100 font-sans relative selection:bg-violet-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1115] via-black to-[#0F1115]" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/5 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-6 pointer-events-none">
        <UniversalCommandBar />
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10 w-full">
        <aside className="w-[30%] min-w-[340px] border-r border-white/5 bg-black/20 backdrop-blur-3xl flex flex-col pt-24">
          <div className="px-6 pb-4 border-b border-white/5 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Zap size={14} className="text-violet-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Execution Canvas</h3>
             </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
             <GraphCanvas sessionId={session.id || 'initial'} />
          </div>
        </aside>

        <main className="flex-1 h-full pt-24 relative overflow-hidden flex flex-col bg-white/[0.01]">
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

        <aside className="w-[20%] min-w-[280px] border-l border-white/5 bg-black/20 backdrop-blur-3xl flex flex-col pt-24">
           <div className="h-[45%] flex flex-col border-b border-white/5 overflow-hidden">
              <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center gap-2">
                 <Activity size={14} className="text-cyan-400" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Agent Roster</h3>
              </div>
              <div className="flex-1 overflow-y-auto"><AgentsView /></div>
           </div>
           <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 py-3 bg-white/5 border-b border-white/5 flex items-center gap-2">
                 <Clock size={14} className="text-zinc-500" />
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Semantic Vault</h3>
              </div>
              <div className="flex-1 overflow-y-auto"><ActivityTimeline /></div>
           </div>
        </aside>
      </div>

      <div className="fixed bottom-8 left-8 z-[300] flex flex-col gap-3 pointer-events-none w-full max-w-md">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      <AppLauncher />
      <UnifiedInbox isOpen={ui.inboxOpen} onClose={toggleInbox} />
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
    <motion.div layout initial={{ opacity: 0, x: -20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl backdrop-blur-3xl">
      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20"><AlertCircle size={18} className="text-rose-500" /></div>
      <div className="flex-1 min-w-0"><span className="text-sm font-bold text-zinc-100 truncate block">{toast.message}</span></div>
      <button onClick={() => onRemove(toast.id)} className="p-1 px-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-500"><CloseIcon size={14} /></button>
    </motion.div>
  );
}
