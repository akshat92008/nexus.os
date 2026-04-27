'use client';

import { useState, useEffect } from 'react';
import { fetchNexus } from '@/lib/api';
import { Bot, CheckCircle, Clock, TrendingUp, AlertTriangle, Play, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Digest {
  metrics: any;
  pendingApprovals: number;
  staleLeads: number;
  recommendations: string[];
}

export default function HomeDashboard() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadDigest();
  }, []);

  const loadDigest = async () => {
    try {
      const data = await fetchNexus('/nexus/digest');
      setDigest(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (task: string, label: string) => {
    setActionLoading(label);
    try {
      await fetchNexus('/nexus/task', {
        method: 'POST',
        body: JSON.stringify({ task })
      });
      await loadDigest();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Nex is preparing your briefing...</span>
      </div>
    );
  }

  if (!digest) return <div>Failed to load briefing.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Bot className="w-8 h-8 text-indigo-600 mr-3" />
            Good morning. Here is your pipeline briefing.
          </h1>
          <p className="mt-1 text-gray-500">I have analyzed your leads and scheduled follow-ups.</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metrics */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Pipeline Metrics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-gray-600">Total Leads</span>
                <span className="text-xl font-bold text-gray-900">{digest.metrics?.total_leads || 0}</span>
              </div>
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-gray-600">Hot Leads</span>
                <span className="text-xl font-bold text-orange-600">{digest.metrics?.hot_leads || 0}</span>
              </div>
              <div className="flex justify-between items-end border-b pb-2">
                <span className="text-gray-600">Pending Approvals</span>
                <span className="text-xl font-bold text-indigo-600">{digest.pendingApprovals}</span>
              </div>
            </div>
            <Link href="/dashboard/analytics" className="mt-4 text-indigo-600 text-sm font-medium hover:text-indigo-800 flex items-center">
              View Detailed Insights <TrendingUp className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 shadow-sm">
            <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wider mb-4 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" /> Quick Actions
            </h2>
            <div className="space-y-3">
              <button 
                onClick={() => handleAction('run_outreach', 'outreach')}
                disabled={!!actionLoading}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center justify-center disabled:opacity-50"
              >
                {actionLoading === 'outreach' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                Run Outreach on Hot Leads
              </button>
              <Link href="/dashboard/import" className="w-full bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition flex items-center justify-center">
                Add New Prospects
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Nex's Recommendations & Queue */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Bot className="w-5 h-5 text-indigo-600 mr-2" />
              Nex's Recommendations
            </h2>
            <ul className="space-y-4">
              {digest.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Clock className="w-5 h-5 text-indigo-600 mr-2" />
                Awaiting Your Approval
              </h2>
              {digest.pendingApprovals > 0 && (
                <Link href="/dashboard/approvals" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full">
                  View All {digest.pendingApprovals}
                </Link>
              )}
            </div>
            
            {digest.pendingApprovals === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                You're all caught up! No drafts need your attention.
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                You have {digest.pendingApprovals} drafts pending.
                <div className="mt-4">
                  <Link href="/dashboard/approvals" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition inline-flex">
                    Review Drafts
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
