'use client';

import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';
import { 
  Flame, 
  Inbox, 
  Activity, 
  CheckCircle, 
  Clock, 
  Zap, 
  Target, 
  TrendingUp, 
  BookOpen, 
  GraduationCap,
  DollarSign,
  PieChart,
  BarChart3,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

export function DashboardView() {
  const workspaces = useNexusStore((s) => s.workspaces);
  const ongoingMissions = useNexusStore((s) => s.ongoingMissions);
  const setActiveWorkspace = useNexusStore((s) => s.setActiveWorkspace);
  const completeAction = useNexusStore((s) => s.completeNextAction);
  const finances = useNexusStore((s) => s.finances);
  const calendar = useNexusStore((s) => s.calendar);
  const timeTracking = useNexusStore((s) => s.timeTracking);
  const invoicing = useNexusStore((s) => s.invoicing);
  
  const { 
    toggleFinancialView, 
    toggleTimeTrackingView, 
    toggleInvoicingView, 
    toggleCalendarView 
  } = useNexusStore();

  const { currentMode } = useModeStore();

  const isStudent = currentMode === 'student';

  // Aggregate global next actions
  const allActions = Object.values(workspaces).flatMap((ws) => 
    (ws.nextActions || []).map(action => ({ ...action, workspaceId: ws.id, goal: ws.goal }))
  ).sort((a, b) => {
    const w = { high: 3, medium: 2, low: 1 };
    return w[b.priority] - w[a.priority];
  });

  const activeOngoing = Object.values(ongoingMissions).filter(m => m.status === 'active');
  const recentWorkspaces = Object.values(workspaces).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  // Stats
  const totalCompletedTasks = Object.values(workspaces).reduce((sum, ws) => {
    return sum + ws.sections.reduce((s2, sec) => {
      if (sec.type === 'tasklist') {
        return s2 + (sec.content as any[]).filter((t: any) => t.status === 'done').length;
      }
      return s2;
    }, 0);
  }, 0);

  if (isStudent) {
    const latestAction = allActions[0];
    const displayTopics = recentWorkspaces.slice(0, 3);
    const displayTasks = allActions.slice(0, 2);

    return (
      <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col gap-10 pb-20 fade-in pt-8">
        
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
                onClick={() => displayTopics[0] && setActiveWorkspace(displayTopics[0].id)}
                className="px-8 py-4 rounded-2xl bg-white text-zinc-950 font-bold text-base hover:scale-105 transition-all shadow-xl shadow-white/5 active:scale-95"
              >
                Continue Work
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
                       No pending tasks. You're all caught up!
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

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-10 pb-20 fade-in pt-4">
      
      {/* 1. Brand Header */}
      <div className="flex items-start justify-between bg-gradient-to-r from-violet-900/20 to-cyan-900/10 p-8 rounded-3xl border border-zinc-800/60 backdrop-blur-md relative overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/20 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
             <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">System Online</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white mb-2">Morning Brief</h2>
          <p className="text-base text-zinc-400 max-w-xl leading-relaxed">
            Welcome back. Here is your daily productivity digest and items requiring your attention.
          </p>

          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => recentWorkspaces[0] && setActiveWorkspace(recentWorkspaces[0].id)}
              className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/20"
            >
              Continue Work
            </button>
            <button 
              onClick={() => useNexusStore.getState().toggleDashboard()}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-semibold text-sm hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              Start New Goal
            </button>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-6 py-4 flex flex-col items-center justify-center min-w-[140px] shadow-lg">
            <div className="flex items-center gap-2 text-violet-400 mb-1"><Activity size={16} /><span className="text-3xl font-black">{activeOngoing.length}</span></div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold text-center">Active Streams</div>
          </div>
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-6 py-4 flex flex-col items-center justify-center min-w-[140px] shadow-lg">
            <div className="flex items-center gap-2 text-cyan-400 mb-1"><Target size={16} /><span className="text-3xl font-black">{totalCompletedTasks}</span></div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold text-center">Tasks Completed</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 🚀 Ongoing Missions (Overnight Progress) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-rose-400 border-b border-zinc-800 pb-3">
            <Flame size={18} />
            <h3 className="font-bold tracking-wide uppercase text-xs">While you were away</h3>
          </div>
          
          <div className="flex flex-col gap-3">
            {activeOngoing.length === 0 ? (
              <div className="text-sm text-zinc-500 p-6 border border-zinc-800/50 border-dashed rounded-2xl text-center bg-zinc-900/20">
                No active background tasks. Start a new goal to see autonomous progress here.
              </div>
            ) : (
              activeOngoing.map(mission => (
                <div key={mission.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-violet-500/50 hover:bg-zinc-900/60 transition-all cursor-pointer group shadow-md" onClick={() => setActiveWorkspace(mission.workspaceId)}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-1 rounded text-center uppercase tracking-widest border border-rose-500/20 flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> Running
                    </span>
                    <span className="text-xs text-zinc-500 font-mono flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                       <Clock size={12} className="text-zinc-600" /> Next: {new Date(mission.nextRun).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-zinc-200 group-hover:text-violet-300 transition-colors leading-tight mb-2">{mission.goal}</h4>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 📊 Business Performance Summary */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp size={18} />
              <h3 className="font-bold tracking-wide uppercase text-xs">Business Performance</h3>
            </div>
            <button onClick={toggleFinancialView} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors">View All</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">Revenue</div>
              <div className="text-xl font-bold text-zinc-100">${finances.revenue.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-400 mt-1 font-bold">↑ 15% this month</div>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">Outstanding</div>
              <div className="text-xl font-bold text-zinc-100">
                ${invoicing.invoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-400 mt-1 font-bold">{invoicing.invoices.filter(i => i.status === 'overdue').length} Overdue</div>
            </div>
          </div>
        </section>

        {/* 📅 Schedule & Productivity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-violet-400">
              <Calendar size={18} />
              <h3 className="font-bold tracking-wide uppercase text-xs">Schedule & Productivity</h3>
            </div>
            <div className="flex gap-4">
               <button onClick={toggleCalendarView} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors">Calendar</button>
               <button onClick={toggleTimeTrackingView} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors">Time</button>
            </div>
          </div>
          
          <div className="space-y-3">
            {calendar.events.slice(0, 2).map(event => (
              <div key={event.id} className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-1 h-6 rounded-full ${event.type === 'meeting' ? 'bg-violet-500' : 'bg-cyan-500'}`} />
                  <div>
                    <div className="text-sm font-bold text-zinc-200">{event.title}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{new Date(event.startTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Clock size={16} className="text-violet-400" />
                  <div className="text-sm font-bold text-violet-300">
                    {timeTracking.activeEntry ? 'Timer Running' : 'Ready to start tracking'}
                  </div>
               </div>
               {timeTracking.activeEntry && <div className="text-sm font-bold text-white animate-pulse">00:45:12</div>}
            </div>
          </div>
        </section>

        {/* 🎯 Next Actions (Manual) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 border-b border-zinc-800 pb-3">
            <Target size={18} />
            <h3 className="font-bold tracking-wide uppercase text-xs">Action Required</h3>
          </div>
          
          <div className="flex flex-col gap-3">
            {allActions.length === 0 ? (
              <div className="text-sm text-zinc-500 p-6 border border-zinc-800/50 border-dashed rounded-2xl text-center bg-zinc-900/20">
                You're all caught up! No actions required right now.
              </div>
            ) : (
              allActions.slice(0, 3).map(action => (
                <div key={action.id} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 group relative overflow-hidden flex items-center justify-between">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-zinc-200 text-sm group-hover:text-cyan-400 transition-colors">{action.title}</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">{action.goal}</p>
                  </div>
                  <button 
                    onClick={() => completeAction(action.workspaceId, action.id)}
                    className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    <CheckCircle size={16} />
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
