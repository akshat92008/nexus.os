// apps/web/components/workspace/ChiefOfStaffBriefing.tsx
import React from 'react';
import { Coffee, Mail, FileText, Calendar, TrendingUp, Sparkles } from 'lucide-react';

export const ChiefOfStaffBriefing = () => {
  const metrics = [
    { label: "Board Prep Docs", value: "3", icon: <FileText className="text-blue-400" />, detail: "Drafts ready for review" },
    { label: "Emails Summarized", value: "12", icon: <Mail className="text-purple-400" />, detail: "Priority signals extracted" },
    { label: "Calendar Conflict", value: "0", icon: <Calendar className="text-emerald-400" />, detail: "All schedules aligned" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Coffee className="text-orange-400" />
            Good morning, Executive.
          </h2>
          <p className="text-white/50 mt-2">Here is your autonomous operational briefing for today.</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4">
          <div className="text-right">
            <span className="block text-xs font-bold text-white/30 uppercase tracking-widest">System Efficiency</span>
            <span className="text-xl font-mono text-emerald-400">98.4%</span>
          </div>
          <TrendingUp className="text-emerald-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m, i) => (
          <div key={i} className="bg-[#0f172a] border border-white/5 rounded-2xl p-6 hover:border-white/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {m.icon}
            </div>
            <div className="text-4xl font-bold text-white mb-1">{m.value}</div>
            <div className="text-sm font-bold text-white/70 uppercase tracking-tight mb-2">{m.label}</div>
            <div className="text-xs text-white/40">{m.detail}</div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles size={120} />
        </div>
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="text-blue-400" size={20} />
            Chief of Staff Insight
          </h3>
          <p className="text-white/80 leading-relaxed max-w-2xl">
            &quot;Your 10:00 AM meeting with the venture team has been prepped with a 1-page summary of their latest fund performance.
            I&apos;ve also drafted follow-ups for the 12 non-critical emails received overnight, focusing on the Q3 partnership inquiries.&quot;
          </p>
          <button className="mt-6 bg-white text-black font-bold px-6 py-2 rounded-lg hover:bg-blue-400 hover:text-white transition-all">
            Review Prep Docs
          </button>
        </div>
      </div>
    </div>
  );
};
