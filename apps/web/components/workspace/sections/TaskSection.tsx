'use client';

import { CheckSquare, Circle, CheckCircle2 } from 'lucide-react';
import { useNexusStore } from '../../../store/nexusStore';
import type { WorkspaceTask } from '@nexus-os/types';

export function TaskSection({ workspaceId, section }: { workspaceId: string, section: any }) {
  const tasks: WorkspaceTask[] = section.content || [];
  const toggleTask = useNexusStore(s => s.toggleTaskStatus);

  if (!tasks.length) return null;

  const completedCount = tasks.filter(t => t.status === 'done').length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-zinc-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckSquare size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">{section.title}</h3>
            {section.description && <p className="text-xs text-zinc-500">{section.description}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-zinc-400 mb-1">{completedCount} / {tasks.length} Completed</div>
          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map(task => (
          <div 
            key={task.id}
            onClick={() => toggleTask(workspaceId, section.id, task.id)}
            className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-800/30 cursor-pointer transition-all"
          >
            <button className="shrink-0 text-zinc-500 hover:text-emerald-400 focus:outline-none transition-colors">
              {task.status === 'done' ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : (
                <Circle size={18} />
              )}
            </button>
            <span className={`text-sm select-none transition-colors ${task.status === 'done' ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>
              {task.title}
            </span>
            {task.priority === 'high' && task.status !== 'done' && (
              <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">High</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
