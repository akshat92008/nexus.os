'use client';

import { useNexusStore } from '../../store/nexusStore';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, PieChart, BarChart3, Wallet, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export function FinancialView() {
  const finances = useNexusStore((s) => s.finances);

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-8 pb-20 fade-in pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Financial Dashboard</h1>
          <p className="text-zinc-500 mt-1">Real-time overview of your business performance.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700">
            Export Report
          </button>
          <button className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20">
            Add Transaction
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Total Revenue" 
          value={`$${finances.revenue.toLocaleString()}`} 
          trend="+15% MoM" 
          isPositive={true} 
          icon={<DollarSign size={20} className="text-emerald-400" />}
        />
        <StatCard 
          label="Total Expenses" 
          value={`$${finances.expenses.toLocaleString()}`} 
          trend="-5% MoM" 
          isPositive={true} 
          icon={<PieChart size={20} className="text-rose-400" />}
        />
        <StatCard 
          label="Net Profit" 
          value={`$${finances.profit.toLocaleString()}`} 
          trend="+22% MoM" 
          isPositive={true} 
          icon={<TrendingUp size={20} className="text-violet-400" />}
        />
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend */}
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <BarChart3 size={16} /> Revenue Trend (Last 12 Months)
            </h3>
          </div>
          <div className="h-48 flex items-end gap-2 px-2">
            {finances.revenueTrend.map((val, i) => (
              <motion.div 
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(val / Math.max(...finances.revenueTrend)) * 100}%` }}
                className="flex-1 bg-violet-500/40 rounded-t-lg hover:bg-violet-500/60 transition-all relative group"
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  ${(val / 1000).toFixed(1)}k
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
            <span>Jan</span>
            <span>Jun</span>
            <span>Dec</span>
          </div>
        </div>

        {/* Top Sources & Expenses */}
        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
              Top Revenue Sources
            </h3>
            <div className="space-y-4">
              {finances.topRevenueSources.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{s.source}</span>
                  <span className="text-sm font-bold text-zinc-100">${s.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
              Top Expenses
            </h3>
            <div className="space-y-4">
              {finances.topExpenses.map((e, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{e.category}</span>
                  <span className="text-sm font-bold text-zinc-100">${e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cash Position & Runway */}
      <div className="p-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/40 to-violet-900/10 backdrop-blur-sm flex flex-wrap gap-12 items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Wallet size={24} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-0.5">Cash Position</div>
            <div className="text-2xl font-bold text-zinc-100">${finances.cashPosition.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20">
            <Clock size={24} className="text-violet-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-0.5">Estimated Runway</div>
            <div className="text-2xl font-bold text-zinc-100">{finances.runway} Months</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <TrendingUp size={24} className="text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-0.5">Profitability</div>
            <div className="text-2xl font-bold text-zinc-100">{((finances.profit / finances.revenue) * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend, isPositive, icon }: any) {
  return (
    <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-zinc-800/20 blur-2xl rounded-full group-hover:bg-zinc-800/40 transition-all" />
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {trend}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">{label}</div>
      <div className="text-3xl font-black text-zinc-100">{value}</div>
    </div>
  );
}
