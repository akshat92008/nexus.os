'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { X, Mail } from 'lucide-react';

export function OnboardingModal() {
  const [isOpen, setIsOpen]               = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [productDesc, setProductDesc]     = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // If email isn't confirmed yet, show verification prompt instead of form
      if (!user.email_confirmed_at) {
        setNeedsVerification(true);
        setIsOpen(true);
        return;
      }

      // Email confirmed but no business context → show onboarding form
      if (!user.user_metadata?.business_context) {
        setIsOpen(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const business_context =
      `Product/Service: ${productDesc}\nTarget Audience: ${targetAudience}`;

    const { error: updateError } = await supabase.auth.updateUser({
      data: { business_context },
    });

    setLoading(false);

    if (updateError) {
      // Detect the specific email verification error from the backend
      if (
        updateError.message?.toLowerCase().includes('email') ||
        updateError.message?.toLowerCase().includes('verification') ||
        updateError.message?.toLowerCase().includes('verified') ||
        updateError.status === 403
      ) {
        setNeedsVerification(true);
      } else {
        setError(
          `Couldn't save: ${updateError.message}. You can skip for now and update in Settings.`
        );
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleResendVerification = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
      setError('Verification email resent! Check your inbox (and spam folder).');
    }
  };

  if (!isOpen) return null;

  // ── Email verification screen ──────────────────────────────────────────
  if (needsVerification) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <Mail className="h-7 w-7 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-600 mb-6">
            We sent a verification link to your email address.
            Click it to activate your account, then come back here.
          </p>
          {error && (
            <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              I've verified — continue
            </button>
            <button
              onClick={handleResendVerification}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Resend verification email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Onboarding form ────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          title="Skip for now"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900">Welcome to Nexus OS</h2>
        <p className="mt-2 text-sm text-gray-600">
          Tell Nex what you sell so your emails sound personal, not generic.
          You can update this anytime in Settings.
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900">
              What do you sell? <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g., We run a design agency that builds high-converting landing pages for B2B SaaS startups."
              className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900">
              Who is your target audience? <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="e.g., Founders and VPs of Marketing at Series A SaaS startups"
              className="mt-2 block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
