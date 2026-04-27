'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productDesc, setProductDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const checkContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.user_metadata?.business_context) {
        setIsOpen(true);
      }
    };
    checkContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const business_context = `Product/Service: ${productDesc}\nTarget Audience: ${targetAudience}`;

    const { error } = await supabase.auth.updateUser({
      data: { business_context }
    });

    setLoading(false);
    if (!error) setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to Nexus OS</h2>
        <p className="mt-2 text-sm text-gray-600">
          Before we draft your first email, the AI needs to know what you sell. 
          This prevents your emails from sounding generic.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900">
              What do you sell? (Product/Service)
            </label>
            <div className="mt-2">
              <textarea
                required
                rows={3}
                placeholder="e.g., We run a design agency that builds high-converting landing pages for B2B SaaS startups."
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900">
              Who is your target audience?
            </label>
            <div className="mt-2">
              <input
                required
                type="text"
                placeholder="e.g., Founders, VPs of Marketing"
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save & Continue to Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
