'use client';

import { useNexusStore } from '../../store/nexusStore';
import { Activity, Bot, User, Zap } from 'lucide-react';
import type { ActivityLog } from '@nexus-os/types';

export function ActivityTimeline() {
  const activeId = useNexusStore(s => s.activeWorkspaceId);
  const workspaces = useNexusStore(s => s.workspaces);

  if (!activeId) return null;
  const workspace = workspaces[activeId];
  if (!workspace || !workspace.activityLog || workspace.activityLog.length === 0) {
    return null;
  }

  const logs = [...workspace.activityLog].sort((a, b) => b.timestamp - a.timestamp);

  const getIcon = (type: string) => {
    switch(type) {
      case 'execution': return <Bot size={12} className="text-cyan-400" />;
      case 'user_action': return <User size={12} className="text-emerald-400" />;
      case 'update': return <Zap size={12} className="text-rose-400" />;
      default: return <Activity size={12} className="text-zinc-400" />;
    }
  };

  return (
    <div className="p-4 bg-zinc-950 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 text-zinc-400 mb-4 pb-2 border-b border-zinc-800/80">
        <Activity size={14} className="text-zinc-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider">Mission Timeline</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="relative border-l border-zinc-800 ml-3 pl-4 space-y-6 pt-2 pb-4">
          {logs.map((log: ActivityLog, index: number) => (
            <div key={log.id} className="relative">
              <span className="absolute -left-6 top-0.5 bg-zinc-950 p-1 rounded-full border border-zinc-800">
                {getIcon(log.type)}
              </span>
              <div>
                <p className={`text-sm tracking-tight ${log.type === 'user_action' ? 'text-emerald-100 font-medium' : 'text-zinc-300'}`}>
                  {log.message}
                </p>
                <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {/* Mission Start indicator */}
          <div className="relative pb-2 opacity-50">
            <span className="absolute -left-[23px] top-1 w-2 h-2 rounded-full border border-zinc-500 bg-zinc-800" />
            <div>
              <p className="text-xs text-zinc-500">Mission Initialized</p>
              <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                {new Date(workspace.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
