'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { UploadCloud, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const data = await fetchWithAuth('/leads/import', {
        method: 'POST',
        body: JSON.stringify({ csv: text }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV file to bulk import leads. Make sure your CSV has an 'email' column. Max 500 rows.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result ? (
        <div className="rounded-lg bg-white p-8 shadow ring-1 ring-black ring-opacity-5 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Import Complete</h2>
          <div className="mt-4 flex justify-center space-x-8 text-sm">
            <div>
              <span className="block text-2xl font-bold text-gray-900">{result.imported}</span>
              <span className="text-gray-500">Imported</span>
            </div>
            <div>
              <span className="block text-2xl font-bold text-gray-900">{result.skipped}</span>
              <span className="text-gray-500">Skipped/Duplicate</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-6 text-left">
              <h3 className="text-sm font-medium text-red-800">Errors ({result.errors.length})</h3>
              <ul className="mt-2 text-sm text-red-700 list-disc pl-5 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
          <div className="mt-8">
            <button
              onClick={() => router.push('/dashboard/leads')}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              View Leads
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-8 shadow ring-1 ring-black ring-opacity-5">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-900/25 bg-white'
            }`}
          >
            <div className="text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500"
                >
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" accept=".csv" className="sr-only" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">CSV up to 10MB</p>
            </div>
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between bg-gray-50 p-4 rounded-md">
              <span className="text-sm font-medium text-gray-900">{file.name}</span>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {loading ? 'Uploading...' : 'Import Now'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
