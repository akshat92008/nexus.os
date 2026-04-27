'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { X } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddLeadModal({ isOpen, onClose, onSuccess }: AddLeadModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await fetchWithAuth('/leads', {
        method: 'POST',
        body: JSON.stringify({ email, name, company, source }),
      });
      setEmail('');
      setName('');
      setCompany('');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-75 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="text-xl font-bold text-gray-900 mb-4">Add Single Lead</h2>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email (Required)</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="alice@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="Alice Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Company (Optional)</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              placeholder="Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
