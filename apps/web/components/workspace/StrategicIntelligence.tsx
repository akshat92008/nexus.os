'use client';

import { Zap, Flame } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';

export function StrategicIntelligence() {
  const globalRisks = useNexusStore((s) => s.globalRisks);
  const globalOpportunities = useNexusStore((s) => s.globalOpportunities);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* ALPHA OPPORTUNITIES */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 px-2">
          <div className="flex items-center gap-3 text-cyan-400">
             <Zap size={18} className="fill-cyan-400/20" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Alpha Opportunities</h3>
          </div>
          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded">Decision Quality: High</span>
        </div>
        
        <div className="grid gap-4">
          {globalOpportunities.length === 0 ? (
            <div className="p-8 rounded-3xl border border-zinc-800 border-dashed text-center text-zinc-600 italic text-sm bg-zinc-900/10">
              Next reflection cycle in progress...
            </div>
          ) : (
            globalOpportunities.map((opp: any) => (
              <div key={opp.id} className="group p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/60 hover:border-cyan-500/30 hover:bg-zinc-900/40 transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-cyan-500/30 group-hover:bg-cyan-500 transition-all" />
                <h4 className="font-bold text-zinc-100 group-hover:text-cyan-400 transition-colors mb-2">{opp.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{opp.description}</p>
                <button className="text-[10px] font-black uppercase tracking-widest text-cyan-500 hover:text-cyan-300 transition-colors">Capitalize Intelligence →</button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* STRATEGIC RISKS */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 px-2">
          <div className="flex items-center gap-3 text-rose-500">
             <Flame size={18} className="fill-rose-500/20" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em]">Strategic Risks</h3>
          </div>
          <span className="text-[10px] font-bold text-rose-500/60 bg-rose-500/5 px-2 py-1 rounded">OS Integrity: 98%</span>
        </div>
        
        <div className="grid gap-4">
          {globalRisks.length === 0 ? (
            <div className="p-8 rounded-3xl border border-zinc-800 border-dashed text-center text-zinc-600 italic text-sm bg-zinc-900/10">
              No critical threats detected.
            </div>
          ) : (
            globalRisks.map((risk: any) => (
              <div key={risk.id} className="p-6 rounded-3xl bg-zinc-900/20 border border-zinc-800/60 hover:border-rose-500/30 transition-all relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500/30" />
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-zinc-100">{risk.title}</h4>
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">{risk.severity}</span>
                </div>
                <p className="text-xs text-zinc-500 mb-4">{risk.description}</p>
                <div className="flex flex-wrap gap-2">
                  {(risk.mitigations || []).map((m: string, i: number) => (
                    <span key={i} className="text-[9px] font-bold text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-lg border border-zinc-700/30">{m}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
