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
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">Nexus OS: Public Beta</h1>
          <p className="text-zinc-500">Currently operating in "Unrestricted Mode" for community feedback.</p>
        </div>

        <div className="p-8 rounded-3xl border border-violet-500/30 bg-violet-500/5 backdrop-blur-sm mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="text-amber-400" size={24} />
            <h2 className="text-xl font-bold text-zinc-100">Unlimited Free Tier</h2>
          </div>
          <p className="text-zinc-400 leading-relaxed mb-6">
            During this deployment phase, all billing gates have been disabled. 
            You can plan and execute as many proactive agent missions as your infrastructure allows without any credit constraints.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              "Unlimited Proactive Missions",
              "Council of Three Consensus",
              "Autonomous Tool Usage",
              "Durable Task Persistence"
            ].map(feature => (
              <div key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                <CheckCircle size={14} className="text-emerald-500" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs text-zinc-600 italic">
          <p>※ Your deployment is running with STRIPE_DISABLED=true.</p>
          <p>※ Billing system can be re-enabled once a payment merchant is connected.</p>
        </div>
      </motion.div>
    </div>
  );
}
