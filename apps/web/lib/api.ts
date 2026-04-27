import { createClient } from './supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006/api/sales';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // F-8: Redirect to login on auth failure instead of confusing error
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired. Redirecting to login...');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return response.json();
}

const NEXUS_API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/sales', '/api') || 'http://localhost:3006/api';

export async function fetchNexus(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${NEXUS_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired. Redirecting to login...');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  return response.json();
}
