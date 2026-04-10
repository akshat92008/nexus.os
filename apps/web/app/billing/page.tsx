'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useNexusStore } from '../../store/nexusStore';

const PACKS = [
  { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_5USD  ?? '', label: 'Starter',    usd: 5,  tasks: '500 tasks',   highlight: false },
  { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_20USD ?? '', label: 'Builder',    usd: 20, tasks: '2,000 tasks', highlight: true  },
  { priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_50USD ?? '', label: 'Pro',        usd: 50, tasks: '5,500 tasks', highlight: false },
];

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useNexusStore((s) => s.session);

  const handleCheckout = async (priceId: string) => {
    if (!priceId) {
      setError('Billing is not configured yet. Set STRIPE price IDs in your environment.');
      return;
    }
    setLoading(priceId);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/?billing=success`,
          cancelUrl:  `${window.location.origin}/billing`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-8 transition-colors">
          <ArrowLeft size={14} /> Back to Command
        </Link>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Top up credits</h1>
          <p className="text-zinc-500">Each agent task costs $0.01. Credits never expire.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {PACKS.map((pack) => (
            <button
              key={pack.priceId || pack.label}
              onClick={() => handleCheckout(pack.priceId)}
              disabled={!!loading}
              className={`relative flex flex-col gap-3 p-6 rounded-2xl border text-left transition-all
                ${pack.highlight
                  ? 'border-violet-500/50 bg-violet-500/5 hover:bg-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pack.highlight && (
                <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-violet-600 text-white font-medium">
                  Popular
                </span>
              )}
              <CreditCard size={20} className={pack.highlight ? 'text-violet-400' : 'text-zinc-500'} />
              <div>
                <p className="text-lg font-bold text-zinc-100">${pack.usd}</p>
                <p className="text-sm text-zinc-400">{pack.label}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Zap size={11} className="text-amber-400" />
                {pack.tasks}
              </div>
              {loading === pack.priceId && (
                <div className="absolute inset-0 rounded-2xl bg-zinc-950/60 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 text-xs text-zinc-600">
          {['Payments secured by Stripe', 'Credits added instantly after payment', 'No subscription — pay only what you use'].map(t => (
            <div key={t} className="flex items-center gap-2">
              <CheckCircle size={12} className="text-emerald-600" />
              {t}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
