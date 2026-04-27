'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';

interface SentEmail {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
  error: string | null;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchWithAuth('/history');
        setHistory(data.history || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  if (loading) return <div className="p-8">Loading history...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sent History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track the status of emails you've approved.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Recipient</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Subject</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {history.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                  No emails sent yet.
                </td>
              </tr>
            ) : (
              history.map((email) => (
                <tr key={email.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                    {email.to_email}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate" title={email.subject}>
                    {email.subject}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {email.status === 'sent' ? (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10" title={email.error || 'Failed'}>
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {email.sent_at ? new Date(email.sent_at).toLocaleString() : new Date(email.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
