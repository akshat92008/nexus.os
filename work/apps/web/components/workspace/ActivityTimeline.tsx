'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Activity, Bot, User, Zap, Database, FileText, Layout, Circle, Clock } from 'lucide-react';
import type { ActivityLog } from '@nexus-os/types';

export function ActivityTimeline() {
  const { 
    activeWorkspaceId: activeId, 
    workspaces,
    artifacts,
    setActiveArtifact
  } = useNexusStore();

  if (!activeId || !workspaces[activeId]) return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-20 grayscale">
       <Database size={24} className="mb-2" />
       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vault Locked</span>
    </div>
  );

  const workspace = workspaces[activeId];
  const logs = [...(workspace.activityLog || [])].sort((a, b) => b.timestamp - a.timestamp);
  
  // Also interleave artifacts in the vault if they exist
  const artifactList = Array.from(artifacts.values()).filter(a => 
     // Simple heuristic: if it matches the current session or goal words
     workspace.goal.toLowerCase().split(' ').some(word => 
       word.length > 3 && a.taskLabel.toLowerCase().includes(word)
     )
  );

  const vaultItems = [
     ...logs.map(l => ({ ...l, vaultType: 'event' as const })),
     ...artifactList.map(a => ({
        id: `artifact-${a.agentId}`,
        timestamp: new Date(a.depositedAt).getTime(),
        message: `Artifact deposited: ${a.taskLabel}`,
        type: 'execution' as any,
        vaultType: 'artifact' as const,
        data: a
     }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  const getIcon = (type: 'event' | 'artifact', logType?: string) => {
    if (type === 'artifact') return <FileText size={12} className="text-cyan-400" />;
    
    switch(logType) {
      case 'execution': return <Bot size={12} className="text-violet-400" />;
      case 'user_action': return <User size={12} className="text-emerald-400" />;
      case 'update': return <Zap size={12} className="text-rose-400" />;
      default: return <Activity size={12} className="text-zinc-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-1 p-4 bg-transparent h-full">
      <AnimatePresence mode="popLayout">
        {vaultItems.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center justify-center py-10 gap-3 opacity-30 grayscale"
          >
             <Database size={32} className="text-zinc-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">No Records Found</span>
          </motion.div>
        ) : (
          vaultItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => {
                 if (item.vaultType === 'artifact') {
                    setActiveArtifact(item.data.agentId);
                 }
              }}
              className={`group flex flex-col gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                 item.vaultType === 'artifact' 
                   ? 'bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/40' 
                   : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                 <div className={`p-1.5 rounded-lg bg-black/40 border border-white/5`}>
                    {getIcon(item.vaultType, item.type)}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500">
                          {item.vaultType === 'artifact' ? 'Artifact Saved' : item.type}
                       </span>
                       <span className="text-[8px] text-zinc-600 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 font-medium leading-relaxed mt-0.5 group-hover:text-white transition-colors">
                       {item.message}
                    </p>
                 </div>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
