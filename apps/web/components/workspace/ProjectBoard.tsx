'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MoreVertical, 
  Plus, 
  Calendar, 
  User, 
  MessageSquare, 
  Link as LinkIcon,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import type { WorkspaceTask } from '@nexus-os/types';

export function ProjectBoard({ workspaceId, sectionId, tasks }: { workspaceId: string, sectionId: string, tasks: WorkspaceTask[] }) {
  const { toggleTaskStatus } = useNexusStore();
  const todo = tasks.filter(t => t.status === 'pending');
  const doing = tasks.filter(t => t.status === 'in-progress');
  const done = tasks.filter(t => t.status === 'done');

  return (
    <div className="p-8 pb-12 overflow-x-auto custom-scrollbar">
      <div className="flex items-start gap-8 min-w-max">
        <KanbanColumn 
          title="To Do" 
          tasks={todo} 
          color="bg-zinc-500" 
          onTaskClick={(tid) => toggleTaskStatus(workspaceId, sectionId, tid)}
        />
        <KanbanColumn 
          title="In Progress" 
          tasks={doing} 
          color="bg-violet-500" 
          onTaskClick={(tid) => toggleTaskStatus(workspaceId, sectionId, tid)}
        />
        <KanbanColumn 
          title="Completed" 
          tasks={done} 
          color="bg-emerald-500" 
          onTaskClick={(tid) => toggleTaskStatus(workspaceId, sectionId, tid)}
        />
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  tasks: WorkspaceTask[];
  color: string;
  onTaskClick: (id: string) => void;
}

function KanbanColumn({ title, tasks, color, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-[300px] flex flex-col gap-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">{title}</h3>
          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <button className="text-zinc-600 hover:text-white transition-colors">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map(task => (
          <motion.div
            layout
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onTaskClick(task.id)}
            className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 hover:border-violet-500/30 transition-all cursor-pointer group shadow-lg"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${
                task.priority === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                task.priority === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                'bg-blue-500/10 text-blue-500 border-blue-500/20'
              }`}>
                {task.priority || 'medium'}
              </div>
              <button className="text-zinc-700 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical size={14} />
              </button>
            </div>

            <h4 className="text-sm font-bold text-zinc-200 mb-4 leading-snug group-hover:text-violet-400 transition-colors">
              {task.title}
            </h4>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800/40">
              <div className="flex -space-x-2">
                 {[1, 2].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                       <User size={10} />
                    </div>
                 ))}
              </div>
              
              <div className="flex items-center gap-3 text-zinc-600">
                 <div className="flex items-center gap-1 text-[10px] font-bold">
                    <MessageSquare size={12} /> 3
                 </div>
                 <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500/60">
                    <CheckCircle2 size={12} /> {task.status === 'done' ? '1/1' : '0/1'}
                 </div>
              </div>
            </div>
          </motion.div>
        ))}
        
        <button className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/10 transition-all flex items-center justify-center gap-2 text-zinc-700 hover:text-zinc-500 group">
           <Plus size={16} className="group-hover:scale-110 transition-transform" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Add Task</span>
        </button>
      </div>
    </div>
  );
}
