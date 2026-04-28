'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Check, X } from 'lucide-react';

interface Approval {
  id: string;
  lead_id: string;
  to_email: string;
  subject: string;
  body: string;
  step: number;
  status: string;
  created_at: string;
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [batchProcessing, setBatchProcessing] = useState(false);

  const loadApprovals = async () => {
    try {
      // The API endpoint /api/sales/approvals lists pending approvals
      const data = await fetchWithAuth('/approvals');
      setApprovals(data.approvals || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject', toEmail: string) => {
    if (processingId) return; // Already processing another — prevent race condition
    setProcessingId(id);
    setSuccessMsg(null);
    try {
      const payload: any = { action };
      if (action === 'approve' && editedBodies[id]) {
        payload.body = editedBodies[id];
      }
      await fetchWithAuth(`/approve/${id}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setApprovals(approvals.filter(a => a.id !== id));
      
      const newEdited = { ...editedBodies };
      delete newEdited[id];
      setEditedBodies(newEdited);
      if (action === 'approve') {
        setSentCount(c => c + 1);
        setSuccessMsg(`✅ Email sent to ${toEmail}!`);
      } else {
        setSuccessMsg(`Draft to ${toEmail} was rejected.`);
      }
    } catch (err: any) {
      setError(`Failed to ${action}: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBatchApprove = async () => {
    if (batchProcessing || approvals.length === 0) return;

    // Safety confirmation for bulk sends
    const count = approvals.length;
    const confirmed = window.confirm(
      `You are about to send ${count} email${count > 1 ? 's' : ''}.\n\n` +
      `These will be sent immediately to real leads. This cannot be undone.\n\n` +
      `Click OK to send all ${count} emails, or Cancel to review them first.` 
    );
    if (!confirmed) return;

    setBatchProcessing(true);
    setSuccessMsg(null);
    try {
      const approvalIds = approvals.map(a => a.id);
      await fetchWithAuth(`/approve-batch`, {
        method: 'POST',
        body: JSON.stringify({ approvalIds }),
      });
      setSentCount(c => c + approvals.length);
      setSuccessMsg(`✅ Batch approved and sent ${approvals.length} emails!`);
      setApprovals([]);
      setEditedBodies({});
    } catch (err: any) {
      setError(`Failed to batch approve: ${err.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  if (loading) return <div className="p-8">Loading approvals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nex's Drafts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve AI-drafted follow-up emails before Nex sends them.
          </p>
        </div>
        {approvals.length > 1 && (
          <button
            onClick={handleBatchApprove}
            disabled={batchProcessing || !!processingId}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {batchProcessing ? 'Processing...' : `Approve All (${approvals.length})`}
          </button>
        )}
      </div>

      {sentCount > 0 && (
        <div className="rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          📧 {sentCount} email{sentCount > 1 ? 's' : ''} sent this session.
        </div>
      )}

      {successMsg && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {approvals.length === 0 && !error ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Check className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">All caught up</h3>
          <p className="mt-1 text-sm text-gray-500">No pending emails to review.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {approvals.map((approval) => (
            <div key={approval.id} className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
              <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">To: {approval.to_email}</h3>
                  <p className="text-xs text-gray-500">Step {approval.step} Follow-up • Drafted {new Date(approval.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleAction(approval.id, 'reject', approval.to_email)}
                    disabled={processingId === approval.id}
                    className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleAction(approval.id, 'approve', approval.to_email)}
                    disabled={processingId === approval.id}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Approve & Send
                  </button>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase text-gray-500">Subject</span>
                  <p className="text-sm font-medium text-gray-900">{approval.subject}</p>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase text-gray-500">Body (Editable)</span>
                  <textarea
                    className="mt-1 block w-full rounded-md border border-gray-300 p-4 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50 hover:bg-white transition-colors custom-scrollbar"
                    rows={8}
                    value={editedBodies[approval.id] ?? approval.body}
                    onChange={(e) => setEditedBodies(prev => ({ ...prev, [approval.id]: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
