'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Zap, Activity, Clock, AlertCircle, X as CloseIcon } from 'lucide-react';

import dynamic from 'next/dynamic';
import { createClient } from '../../lib/supabase';
import { Auth } from '../Auth';
import { ConnectionStatus } from './ConnectionStatus';

const UniversalCommandBar = dynamic(() => import('./UniversalCommandBar').then(mod => mod.UniversalCommandBar), { ssr: false });
const SandboxRouter = dynamic(() => import('./SandboxRouter').then(mod => mod.SandboxRouter), { ssr: false });
const GraphCanvas = dynamic(() => import('./GraphCanvas').then(mod => mod.GraphCanvas), { ssr: false });
const AgentsView = dynamic(() => import('./AgentsView').then(mod => mod.AgentsView), { ssr: false });
const UnifiedInbox = dynamic(() => import('./UnifiedInbox').then(mod => mod.UnifiedInbox), { ssr: false });
const FileSystemView = dynamic(() => import('./FileSystemView').then(mod => mod.FileSystemView), { ssr: false });
const ActivityTimeline = dynamic(() => import('./ActivityTimeline').then(mod => mod.ActivityTimeline), { ssr: false });
const ApprovalModal = dynamic(() => import('./ApprovalModal').then(mod => mod.ApprovalModal), { ssr: false });
const AppLauncher = dynamic(() => import('./AppLauncher').then(mod => mod.AppLauncher), { ssr: false });
const OnboardingWizard = dynamic(() => import('./OnboardingWizard').then(mod => mod.OnboardingWizard), { ssr: false });
const CommandCenter = dynamic(() => import('./CommandCenter').then(mod => mod.CommandCenter), { ssr: false });

import { useNexusStore, selectIsRunning } from '../../store/nexusStore';

export function Workspace() {
  const session = useNexusStore((s) => s.session);
  const waves = useNexusStore((s) => s.waves);
  const events = useNexusStore((s) => s.events);
  const pendingApproval = useNexusStore((s) => s.pendingApproval);
  const isRunning = useNexusStore(selectIsRunning);
  const hydrateFromServer = useNexusStore((s) => s.hydrateFromServer);
  const activeWorkspaceId = useNexusStore((s) => s.activeWorkspaceId);
  const workspaces = useNexusStore((s) => s.workspaces);
  const toasts = useNexusStore((s) => s.toasts);
  const removeToast = useNexusStore((s) => s.removeToast);
  const ui = useNexusStore((s) => s.ui);
  const setUserId = useNexusStore((s) => s.setUserId);
  const setShowAuth = useNexusStore((s) => s.setShowAuth);
  const toggleInbox = useNexusStore((s) => s.toggleInbox);

  useEffect(() => { 
     const initAuth = async () => { 
       const supabase = createClient(); 
       const { data: { session } } = await supabase.auth.getSession(); 
       if (session?.user) { 
         setUserId(session.user.id); 
         setShowAuth(false);
         void hydrateFromServer(session.user.id); 
       } else { 
         setUserId(''); 
         setShowAuth(true);
       } 
     }; 
     void initAuth(); 
   }, [hydrateFromServer, setShowAuth, setUserId]);

  if (ui.showAuth) return <Auth />;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0F1115] text-zinc-100 font-sans relative selection:bg-violet-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1115] via-black to-[#0F1115]" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/5 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-6 pointer-events-none">
        {!activeWorkspaceId && <UniversalCommandBar />}
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10 w-full pt-20">
        <CommandCenter />
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
      <ConnectionStatus />
      {!ui.isOnboardingComplete && <OnboardingWizard />}
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
