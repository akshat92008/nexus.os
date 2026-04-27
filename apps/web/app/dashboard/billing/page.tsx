'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/api';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function BillingPage() {
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsPaid(user?.user_metadata?.is_paid === true);
      setLoading(false);
    };
    checkStatus();
  }, []);

  const handleSubscribe = async () => {
    setProcessing(true);
    setError(null);
    try {
      // In a real app, this would redirect to Razorpay/Stripe Checkout
      // and the webhook would update the status. We mock it here.
      await fetchWithAuth('/subscribe', { method: 'POST' });
      setIsPaid(true);
      // Update local session
      const supabase = createClient();
      await supabase.auth.refreshSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8">Loading billing status...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your Nexus OS plan and payment methods.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isPaid ? (
        <div className="rounded-lg bg-white p-8 shadow ring-1 ring-black ring-opacity-5">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-900">Pro Plan Active</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Your subscription is active. You have full access to all features, including unlimited email sends and AI drafting.
          </p>
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">
              Billing cycle: Renews automatically every month.
            </p>
            <button className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Manage in Razorpay Portal &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white overflow-hidden shadow ring-1 ring-black ring-opacity-5">
          <div className="bg-indigo-600 px-8 py-10 text-center">
            <h2 className="text-3xl font-bold text-white mb-2">Upgrade to Pro</h2>
            <p className="text-indigo-100 mb-6">Unlock the full power of your AI Sales Agent.</p>
            <div className="text-5xl font-extrabold text-white mb-8">
              ₹999<span className="text-xl text-indigo-200 font-medium">/mo</span>
            </div>
            <button
              onClick={handleSubscribe}
              disabled={processing}
              className="bg-white text-indigo-600 w-full sm:w-auto px-8 py-3 rounded-full font-bold hover:bg-gray-50 transition disabled:opacity-75"
            >
              {processing ? 'Processing...' : 'Subscribe via Razorpay (Mock)'}
            </button>
          </div>
          
          <div className="px-8 py-8 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">What's included</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-600">Unlimited Lead Imports & AI Scoring</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-600">Unlimited Personalized AI Drafts</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-600">Automated 3-Step Follow-up Sequences</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                <span className="text-gray-600">Full Analytics & Conversion Tracking</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
