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
const AgentMarketplace = dynamic(() => import('../market/AgentMarketplace').then(mod => mod.AgentMarketplace), { ssr: false });
const LibraryView = dynamic(() => import('./LibraryView').then(mod => mod.LibraryView), { ssr: false });
const WorkspaceHistorySidebar = dynamic(() => import('./WorkspaceHistorySidebar').then(mod => mod.WorkspaceHistorySidebar), { ssr: false });
const MissionExecutionPanel = dynamic(() => import('./MissionExecutionPanel').then(mod => mod.MissionExecutionPanel), { ssr: false });
const SettingsView = dynamic(() => import('./SettingsView').then(mod => mod.SettingsView), { ssr: false });
const CodeReviewPanel = dynamic(() => import('./CodeReviewPanel').then(mod => mod.CodeReviewPanel), { ssr: false });
const GitPanel = dynamic(() => import('./GitPanel').then(mod => mod.GitPanel), { ssr: false });
const ProjectOnboarding = dynamic(() => import('./ProjectOnboarding').then(mod => mod.ProjectOnboarding), { ssr: false });
const IntegrationsView = dynamic(() => import('./IntegrationsView').then(mod => mod.IntegrationsView), { ssr: false });
const TerminalView = dynamic(() => import('./TerminalView').then(mod => mod.TerminalView), { ssr: false });

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
  const toggleMissionPanel = useNexusStore((s) => s.toggleMissionPanel);
  const toggleSettings = useNexusStore((s) => s.toggleSettings);
  const toggleIntegrationsView = useNexusStore((s) => s.toggleIntegrationsView);
  const toggleCodeReview = useNexusStore((s) => s.toggleCodeReview);
  const toggleGitPanel = useNexusStore((s) => s.toggleGitPanel);
  const toggleProjectOnboarding = useNexusStore((s) => s.toggleProjectOnboarding);
  const toggleTerminal = useNexusStore((s) => s.toggleTerminal);

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
    <div className="h-screen w-screen overflow-hidden flex bg-[#0D0D0D] text-zinc-100 font-sans relative selection:bg-violet-500/30">
      {/* Background Grid */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <WorkspaceHistorySidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 p-4 pl-0">
        <div className="flex-1 flex flex-col bg-[#121212] rounded-[40px] border border-white/5 overflow-hidden relative shadow-2xl">
          {ui.missionPanelOpen ? <MissionExecutionPanel /> :
           ui.settingsViewOpen ? <SettingsView /> :
           ui.integrationsViewOpen ? <IntegrationsView /> :
           ui.codeReviewOpen ? <CodeReviewPanel /> :
           ui.gitPanelOpen ? <GitPanel /> :
           ui.projectOnboardingOpen ? <ProjectOnboarding /> :
           ui.terminalOpen ? <TerminalView /> :
           <CommandCenter />}
        </div>
      </main>

      <div className="fixed bottom-8 left-8 z-[300] flex flex-col gap-3 pointer-events-none w-full max-w-md">
        <AnimatePresence mode="popLayout">
          {(toasts || []).map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>

      <AppLauncher />
      <UnifiedInbox isOpen={ui.inboxOpen} onClose={toggleInbox} />
      <FileSystemView />
      <ApprovalModal />
      <ConnectionStatus />
      <LibraryView />
      <AgentMarketplace />
      {!ui.isOnboardingComplete && <OnboardingWizard />}
    </div>
  );
}

import { forwardRef } from 'react';

const ToastItem = forwardRef<HTMLDivElement, { toast: any; onRemove: (id: string) => void }>(({ toast, onRemove }, ref) => {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <motion.div ref={ref} layout initial={{ opacity: 0, x: -20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl backdrop-blur-3xl">
      <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20"><AlertCircle size={18} className="text-rose-500" /></div>
      <div className="flex-1 min-w-0"><span className="text-sm font-bold text-zinc-100 truncate block">{toast.message}</span></div>
      <button onClick={() => onRemove(toast.id)} className="p-1 px-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-500"><CloseIcon size={14} /></button>
    </motion.div>
  );
});

ToastItem.displayName = 'ToastItem';
