'use client';

import { motion, useSpring } from 'framer-motion';
import { useEffect } from 'react';
import { TrendingDown, Coins, ArrowDown } from 'lucide-react';
import { useNexusStore, selectRoiSavings } from '../../store/nexusStore';

function AnimatedCost({ value, prefix = '$', decimals = 4 }: {
  value: number;
  prefix?: string;
  decimals?: number;
}) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span>
      {prefix}
      {value.toFixed(decimals)}
    </motion.span>
  );
}

function StatRow({
  label,
  value,
  color,
  strikethrough = false,
}: {
  label: string;
  value: string;
  color: string;
  strikethrough?: boolean;
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

export function TokenROIWidget() {
  const ledger             = useNexusStore((s) => s.ledger);
  const savings            = useNexusStore(selectRoiSavings);
  const transactionCount   = ledger.transactionCount;
  const hasSavings         = savings > 0;

  const savingsPct = ledger.sequentialEstimate > 0
    ? Math.round((savings / ledger.sequentialEstimate) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black backdrop-blur-xl overflow-hidden shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 to-transparent pointer-events-none" />
      
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-emerald-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
            Token ROI
          </span>
        </div>
        {hasSavings && (
          <span className="text-[10px] font-mono font-bold rounded-md px-2 py-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 tracking-wider">
            -{savingsPct}% VOL
          </span>
        )}
      </div>

      <div className="relative px-4 py-3 space-y-1">
        <StatRow
          label="Actual"
          value={`$${ledger.totalFeeUsd.toFixed(4)}`}
          color="#a855f7" // purple-500 as active
        />
        <StatRow
          label="Sequential"
          value={`$${ledger.sequentialEstimate.toFixed(4)}`}
          color="#52525b" // zinc-600
          strikethrough={hasSavings}
        />
        <StatRow
          label="Tokens"
          value={ledger.totalTokensUsed.toLocaleString()}
          color="#0ea5e9" // sky-500
        />
        <StatRow
          label="Tasks"
          value={String(transactionCount)}
          color="#f59e0b" // amber-500
        />

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
              ${savings.toFixed(4)}
            </div>
          </motion.div>
        )}

        {transactionCount === 0 && (
          <div className="py-6 text-center opacity-30 flex flex-col items-center gap-3">
            <Coins size={24} className="text-zinc-600" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              Awaiting Stream
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
