'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { CheckCircle2, Zap } from 'lucide-react';

export default function BillingPage() {
  const [isPaid, setIsPaid]     = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsPaid(user?.user_metadata?.is_paid === true);
      setLoading(false);
    })();
  }, []);

  // In production: set NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL to your
  // Razorpay Payment Link URL (from razorpay.com → Payment Links).
  // Until that's set, the button opens a support email.
  const checkoutUrl = process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL
    || `mailto:support@nexusos.app?subject=Pro%20Plan%20Upgrade&body=Hi%2C%20I%27d%20like%20to%20upgrade%20to%20Pro.`;

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading billing status…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your Nexus OS plan.</p>
      </div>

      {isPaid ? (
        /* ── Active plan ── */
        <div className="rounded-lg bg-white p-8 shadow ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900">Pro Plan Active</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Your subscription is active. You have full access to all Nexus OS features.
          </p>
          <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            Need to cancel or update payment details?{' '}
            <a
              href="mailto:support@nexusos.app?subject=Billing"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Contact support →
            </a>
          </div>
        </div>
      ) : (
        /* ── Upgrade CTA ── */
        <div className="rounded-lg bg-white overflow-hidden shadow ring-1 ring-black ring-opacity-5">
          <div className="bg-indigo-600 px-8 py-10 text-center">
            <Zap className="mx-auto h-10 w-10 text-indigo-200 mb-3" />
            <h2 className="text-3xl font-bold text-white mb-2">Upgrade to Pro</h2>
            <p className="text-indigo-100 mb-6">
              Unlock unlimited AI emails, scoring, and follow-up sequences.
            </p>
            <div className="text-5xl font-extrabold text-white mb-8">
              ₹999<span className="text-xl text-indigo-200 font-medium">/mo</span>
            </div>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-gray-50 transition"
            >
              Upgrade Now →
            </a>
            <p className="mt-3 text-xs text-indigo-200">
              Secure payment via Razorpay. Cancel anytime.
            </p>
          </div>

          <div className="px-8 py-8 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              What's included
            </h3>
            <ul className="space-y-3 text-sm text-gray-600">
              {[
                'Unlimited Lead Imports & AI Scoring',
                'Unlimited Personalised AI Email Drafts',
                'Automated 3-Step Follow-up Sequences',
                'Full Analytics & Conversion Dashboard',
                'Priority Email Support',
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
