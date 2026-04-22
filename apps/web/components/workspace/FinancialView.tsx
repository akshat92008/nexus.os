'use client';

/**
 * Nexus OS — Financial Dashboard v2.2 (Stabilized)
 *
 * FIX: Implements "Honest Empty States".
 * Prevents seed-data hallucinations for new users by showing clear CTAs 
 * to connect real data sources instead of fake hardcoded numbers.
 */

import { useNexusStore } from '../../store/nexusStore';
import { motion } from 'framer-motion';
import {
  TrendingUp, DollarSign, PieChart, 
  BarChart3, Plus, Link2, Wallet, Clock
} from 'lucide-react';

export function FinancialView() {
  const finances = useNexusStore((s) => s.finances);

  // Verification: Real data exists if there are records in the history
  const hasRealData = finances.records && finances.records.length > 0;

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-8 pb-20 fade-in pt-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Financial Dashboard</h1>
          <p className="text-zinc-500 mt-1">Real-time overview of your business performance.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed" disabled={!hasRealData}>
            Export Report
          </button>
          <button className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2">
            <Plus size={14} />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Revenue"
          value={`$${(finances.revenue ?? 0).toLocaleString()}`}
          trend={hasRealData ? undefined : 'Waiting for data...'}
          icon={<DollarSign size={20} className="text-emerald-400" />}
        />
        <StatCard
          label="Total Expenses"
          value={`$${(finances.expenses ?? 0).toLocaleString()}`}
          trend={hasRealData ? undefined : 'Waiting for data...'}
          icon={<PieChart size={20} className="text-rose-400" />}
        />
        <StatCard
          label="Net Profit"
          value={`$${((finances.revenue ?? 0) - (finances.expenses ?? 0)).toLocaleString()}`}
          trend={hasRealData ? undefined : 'Waiting for data...'}
          icon={<TrendingUp size={20} className="text-violet-400" />}
        />
      </div>

      {/* Empty State / Dashboard Content */}
      {!hasRealData ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-8 py-24 rounded-[2.5rem] border border-dashed border-zinc-800 bg-zinc-900/20 backdrop-blur-sm shadow-inner"
        >
          <div className="w-16 h-16 rounded-3xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-xl shadow-violet-500/5">
            <BarChart3 size={32} className="text-violet-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-zinc-100 font-bold text-xl">No Financial Activity Detected</h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
              Connect your bank, stripe, or accounting software to begin tracking revenue, Runway, and cash flow in real-time.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 transition-all shadow-xl shadow-violet-500/30">
              <Link2 size={16} />
              Connect Data Source
            </button>
            <button className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700">
              <Plus size={16} />
              Import CSV
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* Legacy positions for cash/runway if real data exists */}
          <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 flex flex-wrap gap-12 items-center">
             <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Wallet size={24} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-500 mb-0.5 uppercase tracking-wider">Cash Position</div>
                <div className="text-2xl font-bold text-zinc-100">${(finances.cashPosition ?? 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Clock size={24} className="text-violet-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-500 mb-0.5 uppercase tracking-wider">Runway</div>
                <div className="text-2xl font-bold text-zinc-100">{finances.runway ?? 0} Months</div>
              </div>
            </div>
          </div>

          {/* Transaction Ledger */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-8 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
              <h2 className="text-zinc-100 font-bold text-sm tracking-tight">Recent Activity</h2>
              <span className="text-zinc-500 text-xs font-medium bg-zinc-800 px-2 py-1 rounded-md">{finances.records.length} transactions</span>
            </div>
            <div className="divide-y divide-zinc-800/60 max-h-[400px] overflow-y-auto custom-scrollbar">
              {finances.records.map((record: any, i: number) => (
                <div key={record.id ?? i} className="flex items-center justify-between px-8 py-4 hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${record.amount >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} shadow-sm shadow-black`} />
                    <div>
                      <p className="text-zinc-200 text-sm font-semibold">{record.label ?? 'System Transaction'}</p>
                      <p className="text-zinc-500 text-[11px] font-medium">{new Date(record.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${record.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {record.amount >= 0 ? '+' : '-'}${Math.abs(record.amount ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function StatCard({ label, value, trend, icon }: { label: string; value: string; trend?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-7 flex flex-col gap-4 hover:border-zinc-700 transition-all group">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{label}</span>
        <div className="p-2 rounded-xl bg-zinc-950/50 border border-zinc-800 group-hover:bg-zinc-800/50 transition-all">
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-black text-zinc-100 tracking-tight">{value}</p>
        {trend && (
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">{trend}</span>
        )}
      </div>
    </div>
  );
}
