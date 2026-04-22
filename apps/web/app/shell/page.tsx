// apps/web/app/shell/page.tsx
'use client';
import React, { useState } from 'react';
import { StatusHud } from '@/components/shell/StatusHud';
import { ChiefOfStaffBriefing } from '@/components/workspace/ChiefOfStaffBriefing';
import { APApprovalCockpit } from '@/components/workspace/APApprovalCockpit';
import { useNexusStore } from '@/store/nexusStore';

export default function ExecutiveShell() {
  const [activeView, setActiveView] = useState<'briefing' | 'ap_resolver'>('briefing');
  const hasPendingApproval = useNexusStore((s) => Boolean(s.pendingApproval));

  return (
    <div className="flex h-screen bg-[#0a0f18] text-white font-sans selection:bg-emerald-500/30">
      <StatusHud brainStatus="online" currentAgent={activeView === 'briefing' ? 'LifeAgent' : 'SysAgent'} />
      
      <main className="flex-grow flex flex-col p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
          <h1 className="text-2xl font-bold tracking-widest text-white/90">NEXUS OS // Executive</h1>
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveView('briefing')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeView === 'briefing' ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              Morning Briefing
            </button>
            <button 
              onClick={() => setActiveView('ap_resolver')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeView === 'ap_resolver' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
            >
              AP Exceptions {hasPendingApproval ? '(1 Pending)' : '(Demo)'}
            </button>
          </div>
        </header>

        <div className="flex-grow">
          {activeView === 'briefing' ? <ChiefOfStaffBriefing /> : <APApprovalCockpit />}
        </div>
      </main>
    </div>
  );
}
