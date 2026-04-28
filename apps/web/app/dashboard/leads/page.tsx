'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Mail, Plus } from 'lucide-react';
import { AddLeadModal } from '@/components/AddLeadModal';

interface Lead {
  id: string;
  email: string;
  name?: string;
  company?: string;
  role?: string;
  score: number;
  status: string;
  source: string;
  created_at: string;
  last_contacted_at?: string;
}

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  new:           { label: 'New',           color: 'bg-gray-100 text-gray-700' },
  qualified:     { label: 'AI Scored',     color: 'bg-blue-100 text-blue-700' },
  contacted:     { label: 'Email Sent',    color: 'bg-indigo-100 text-indigo-700' },
  booked:        { label: '🗓 Meeting Set', color: 'bg-green-100 text-green-700' },
  lost:          { label: 'Not interested', color: 'bg-red-100 text-red-600' },
  unsubscribed:  { label: 'Unsubscribed',  color: 'bg-orange-100 text-orange-700' },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const router = useRouter();

  const loadLeads = async () => {
    try {
      const data = await fetchWithAuth('/leads?limit=50');
      setLeads(data.leads || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const handleScoreBatch = async () => {
    setScoring(true);
    setSuccessMsg(null);
    try {
      const result = await fetchWithAuth('/qualify-batch', {
        method: 'POST',
        body: JSON.stringify({ limit: 20 }),
      });
      await loadLeads();
      setSuccessMsg(`Scored ${result.processed || 0} leads. Check your Approval Queue for hot leads!`);
    } catch (err: any) {
      setError(`AI scoring failed: ${err.message || 'Please try again.'}`);
    } finally {
      setScoring(false);
    }
  };

  // F-2: Draft Follow-up for a single lead
  const handleDraftFollowUp = async (lead: Lead) => {
    setDraftingId(lead.id);
    setSuccessMsg(null);
    
    // Calculate actual days since last contact
    const daysSinceContact = lead.last_contacted_at
      ? Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0; // 0 = first contact, not a follow-up

    try {
      await fetchWithAuth(`/leads/${lead.id}/followup`, {
        method: 'POST',
        body: JSON.stringify({ daysSinceContact }),
      });
      setSuccessMsg(`✅ Draft created for ${lead.email}! Check your Approval Queue.`);
    } catch (err: any) {
      setError(`Couldn't create draft for ${lead.email}. ${err.message || 'Please try again.'}`);
    } finally {
      setDraftingId(null);
    }
  };

  if (loading) return <div className="p-8">Loading leads...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and score your captured leads.
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleScoreBatch}
            disabled={scoring}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {scoring ? 'Scoring...' : 'Score Unqualified Leads'}
          </button>
          {/* F-3: Wire Import CSV button to navigate to /dashboard/import */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
            Add Lead
          </button>
          <button
            onClick={() => router.push('/dashboard/import')}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Import CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Lead</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Score</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Source</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                  No leads found. Try importing a CSV.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                    <div className="font-medium text-gray-900">{lead.email}</div>
                    <div className="text-gray-500">
                      {lead.name ? `${lead.name} • ` : ''}
                      {lead.company || ''}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      lead.score >= 70 ? 'bg-green-100 text-green-800' :
                      lead.score >= 40 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {lead.score || 'Unscored'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {(() => {
                      const s = STATUS_DISPLAY[lead.status] || { label: lead.status, color: 'bg-gray-100 text-gray-700' };
                      return (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
                          {s.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {lead.source}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  {/* F-2: Draft Follow-up button for each lead */}
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <button
                      onClick={() => handleDraftFollowUp(lead)}
                      disabled={draftingId === lead.id || lead.status === 'booked' || lead.status === 'lost'}
                      className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={lead.status === 'booked' || lead.status === 'lost' ? 'Not eligible for follow-up' : 'Draft a follow-up email for approval'}
                    >
                      <Mail className="mr-1 h-3.5 w-3.5" />
                      {draftingId === lead.id ? 'Drafting...' : 'Draft Email'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <AddLeadModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          setSuccessMsg('Lead added successfully.');
          loadLeads();
        }}
      />
    </div>
  );
}
