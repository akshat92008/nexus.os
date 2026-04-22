'use client';

import { BookOpen, Target, GraduationCap, ChevronRight } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';

interface StudentDashboardProps {
  displayTopics: any[];
  displayTasks: any[];
}

export function StudentDashboard({ displayTopics, displayTasks }: StudentDashboardProps) {
  const setActiveWorkspace = useNexusStore((s) => s.setActiveWorkspace);
  const completeAction = useNexusStore((s) => s.completeNextAction);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col gap-10 pb-20 pt-8 fade-in">
      {/* Student Branding */}
      <div className="flex items-start justify-between bg-zinc-900/40 p-10 rounded-[32px] border border-zinc-800/80 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
             <GraduationCap size={20} className="text-violet-400" />
             <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Academic Assistant</span>
          </div>
          <h2 className="text-5xl font-black tracking-tight text-white mb-4">Good Morning.</h2>
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            Your learning materials are ready. Pick up where you left off or start a new topic.
          </p>

          <div className="flex gap-4 mt-8">
            <button 
              disabled={displayTopics.length === 0}
              onClick={() => displayTopics[0] && setActiveWorkspace(displayTopics[0].id)}
              className={`px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-xl active:scale-95 flex items-center gap-2 ${
                displayTopics.length > 0 
                  ? 'bg-white text-zinc-950 hover:scale-105 shadow-white/5' 
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
              }`}
            >
              Continue Work
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => {
                useNexusStore.getState().toggleDashboard();
                useNexusStore.getState().resetWorkspace();
                useNexusStore.getState().setCommandBarFocused(true);
              }}
              className="px-8 py-4 rounded-2xl bg-zinc-800/50 text-zinc-300 font-bold text-base border border-zinc-700/50 hover:bg-zinc-800 transition-all active:scale-95"
            >
              Start New Topic
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* Recent Topics */}
         <section className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
               <BookOpen size={16} /> Recent Topics
            </h3>
            <div className="flex flex-col gap-4">
               {displayTopics.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-zinc-800 border-dashed text-zinc-600 text-sm italic">
                     No recent topics yet. Start by asking anything in the box above.
                  </div>
               ) : (
                  displayTopics.map(ws => (
                     <div key={ws.id} onClick={() => setActiveWorkspace(ws.id)} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/60 transition-all cursor-pointer group">
                        <h4 className="font-bold text-zinc-200 group-hover:text-violet-400 transition-colors">{ws.goal}</h4>
                        <span className="text-xs text-zinc-500 mt-1 block">Last viewed {new Date(ws.createdAt).toLocaleDateString()}</span>
                     </div>
                  ))
               )}
            </div>
         </section>

         {/* Suggested Next Task */}
         <section className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
               <Target size={16} /> Suggested Next Task
            </h3>
            <div className="flex flex-col gap-4">
               {displayTasks.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-zinc-800 border-dashed text-zinc-600 text-sm italic">
                     No pending tasks. You&apos;re all caught up!
                  </div>
               ) : (
                  displayTasks.map(task => (
                     <div key={task.id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 group relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
                        <h4 className="font-bold text-zinc-200 text-sm">{task.title}</h4>
                        <p className="text-xs text-zinc-500 mt-2">Topic: {task.goal}</p>
                        <button 
                           onClick={() => completeAction(task.workspaceId, task.id)}
                           className="mt-4 w-full py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"
                        >
                           Mark as Done
                        </button>
                     </div>
                  ))
               )}
            </div>
         </section>
      </div>
    </div>
  );
}
