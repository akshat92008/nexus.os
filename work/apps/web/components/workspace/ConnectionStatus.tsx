'use client';

import { useMemo } from 'react';
import { useNexusSSE } from '../../hooks/useNexusSSE';

const statusConfig = {
  connected:    { dot: 'bg-emerald-400', text: 'Connected',      bg: 'bg-emerald-950/60' },
  connecting:   { dot: 'bg-yellow-400 animate-pulse', text: 'Connecting...', bg: 'bg-yellow-950/60' },
  reconnecting: { dot: 'bg-yellow-400 animate-pulse', text: 'Retry #', bg: 'bg-yellow-950/60' },
  failed:       { dot: 'bg-red-400', text: 'Lost connection', bg: 'bg-red-950/60' },
} as const;

export function ConnectionStatus() {
  const { status, retryCount, manualRetry } = useNexusSSE();
  const config = statusConfig[status] ?? statusConfig.connecting;

  const label = useMemo(() => {
    if (status === 'reconnecting') {
      return `Retry #${retryCount}`;
    }
    return config.text;
  }, [config.text, retryCount, status]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-3xl px-4 py-3 ${config.bg} text-white shadow-2xl shadow-black/25`}>
      <span className={`h-3 w-3 rounded-full ${config.dot}`} />
      <span className="text-xs font-semibold tracking-wide">{label}</span>
      {status === 'failed' && (
        <button
          onClick={manualRetry}
          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white hover:bg-white/15 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
