'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';

interface FunnelMetrics {
  period: string;
  total_leads: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  avg_score: number;
  conversion_rate: number;
  follow_up_rate: number;
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/analytics/funnel?days=${days}`);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [days]);

  if (loading) return <div className="p-8">Loading analytics...</div>;

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
    );
  }

  const statCards = metrics ? [
    { label: 'Total Leads', value: metrics.total_leads },
    { label: 'Avg Score', value: Math.round(metrics.avg_score || 0) },
    { label: 'Conversion Rate', value: `${Math.round(metrics.conversion_rate || 0)}%` },
    { label: 'Follow-up Rate', value: `${Math.round(metrics.follow_up_rate || 0)}%` },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your sales funnel performance.
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow ring-1 ring-black ring-opacity-5">
            <dt className="truncate text-sm font-medium text-gray-500">{stat.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stat.value}</dd>
          </div>
        ))}
      </div>

      {/* By Status */}
      {metrics && Object.keys(metrics.by_status).length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Leads by Status</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(metrics.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">{status}</span>
                  <div className="flex items-center">
                    <div className="mr-3 h-2 rounded-full bg-indigo-200" style={{ width: `${Math.max(20, (count / metrics.total_leads) * 200)}px` }}>
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: '100%' }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* By Source */}
      {metrics && Object.keys(metrics.by_source).length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-black ring-opacity-5">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Leads by Source</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(metrics.by_source).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 capitalize">{source}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {metrics && metrics.total_leads === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No data yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Import at least 10 leads to start seeing funnel analytics.
          </p>
        </div>
      )}
    </div>
  );
}
