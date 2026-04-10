/**
 * TokenROIWidget — Task 20
 * - Fetches real data from GET /api/ledger/:userId
 * - Shows: total spent this session, tasks run, avg cost per task
 * - Session Budget input that warns when 80% consumed
 */
'use client';

import { motion, useSpring } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { TrendingDown, Coins, ArrowDown, AlertTriangle } from 'lucide-react';
import { useNexusStore, selectRoiSavings } from '../../store/nexusStore';
import { createClient } from '../../lib/supabase';
import { API_BASE } from '../../hooks/useNexusSSE';

function AnimatedCost({ value, prefix = '$', decimals = 4 }: {
  value: number; prefix?: string; decimals?: number;
}) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });
  useEffect(() => { spring.set(value); }, [value, spring]);
  return <motion.span>{prefix}{value.toFixed(decimals)}</motion.span>;
}

function StatRow({ label, value, color, strikethrough = false }: {
  label: string; value: string; color: string; strikethrough?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/80 last:border-0 hover:bg-zinc-800/30 px-1 transition-colors">
      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{label}</span>
      <span
        className={`text-xs font-mono font-bold tracking-wider tabular-nums ${strikethrough ? 'line-through opacity-40' : 'drop-shadow-sm'}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

interface LedgerData {
  totalFeeUsd: number;
  totalTokensUsed: number;
  transactionCount: number;
  sequentialEstimate: number;
}

async function fetchLedger(userId: string): Promise<LedgerData | null> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE}/api/ledger/${userId}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function TokenROIWidget() {
  const ledger           = useNexusStore((s) => s.ledger);
  const savings          = useNexusStore(selectRoiSavings);
  const [remoteData, setRemoteData]     = useState<LedgerData | null>(null);
  const [sessionBudget, setSessionBudget] = useState<string>('');
  const [userId, setUserId]             = useState<string | null>(null);

  // Resolve userId once
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  // Poll real ledger data every 30 s
  const refresh = useCallback(async () => {
    if (!userId) return;
    const data = await fetchLedger(userId);
    if (data) setRemoteData(data);
  }, [userId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Prefer remote data when available, fall back to store
  const totalFee         = remoteData?.totalFeeUsd       ?? ledger.totalFeeUsd;
  const totalTokens      = remoteData?.totalTokensUsed   ?? ledger.totalTokensUsed;
  const transactionCount = remoteData?.transactionCount  ?? ledger.transactionCount;
  const seqEstimate      = remoteData?.sequentialEstimate ?? ledger.sequentialEstimate;
  const realSavings      = seqEstimate > 0 ? Math.max(0, seqEstimate - totalFee) : savings;
  const hasSavings       = realSavings > 0;
  const avgCost          = transactionCount > 0 ? totalFee / transactionCount : 0;

  const budgetNum        = parseFloat(sessionBudget);
  const budgetValid      = !isNaN(budgetNum) && budgetNum > 0;
  const budgetPct        = budgetValid ? (totalFee / budgetNum) * 100 : 0;
  const budgetWarning    = budgetValid && budgetPct >= 80;

  const savingsPct = seqEstimate > 0 ? Math.round((realSavings / seqEstimate) * 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black backdrop-blur-xl overflow-hidden shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 to-transparent pointer-events-none" />

      <div className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-emerald-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Token ROI</span>
        </div>
        {hasSavings && (
          <span className="text-[10px] font-mono font-bold rounded-md px-2 py-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 tracking-wider">
            -{savingsPct}% VOL
          </span>
        )}
      </div>

      <div className="relative px-4 py-3 space-y-1">
        <StatRow label="Actual"     value={`$${totalFee.toFixed(4)}`}        color="#a855f7" />
        <StatRow label="Sequential" value={`$${seqEstimate.toFixed(4)}`}     color="#52525b" strikethrough={hasSavings} />
        <StatRow label="Avg/Task"   value={`$${avgCost.toFixed(4)}`}         color="#0ea5e9" />
        <StatRow label="Tokens"     value={totalTokens.toLocaleString()}      color="#0ea5e9" />
        <StatRow label="Tasks"      value={String(transactionCount)}          color="#f59e0b" />

        {/* Session Budget Input */}
        <div className="pt-2 pb-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
            Session Budget ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.05"
            value={sessionBudget}
            onChange={(e) => setSessionBudget(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {budgetValid && (
            <div className={`mt-1.5 rounded-md px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold ${
              budgetWarning
                ? 'bg-amber-950/40 border border-amber-900 text-amber-400'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
            }`}>
              {budgetWarning && <AlertTriangle size={10} />}
              {budgetPct.toFixed(1)}% of budget used
              {budgetWarning && ' — approaching limit'}
            </div>
          )}
        </div>

        {hasSavings && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 rounded-lg p-3 text-center space-y-1 bg-[#001405] border border-[#003310] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-600 uppercase tracking-widest font-black">
              <ArrowDown size={12} className="animate-bounce" />
              NET SAVINGS
            </div>
            <div className="text-2xl font-black text-[#00ff41] font-mono tracking-tight tabular-nums drop-shadow-[0_0_8px_rgba(0,255,65,0.4)]">
              <AnimatedCost value={realSavings} />
            </div>
          </motion.div>
        )}

        {transactionCount === 0 && (
          <div className="py-6 text-center opacity-30 flex flex-col items-center gap-3">
            <Coins size={24} className="text-zinc-600" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Awaiting Stream</p>
          </div>
        )}
      </div>
    </div>
  );
}
