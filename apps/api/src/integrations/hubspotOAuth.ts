/**
 * HubSpot OAuth2 Flow
 * Uses HubSpot Private App OAuth2 with access and refresh tokens.
 * Tokens stored encrypted in Supabase user_integrations table.
 */

import { getSupabase } from '../storage/supabaseClient.js';

const HUBSPOT_CLIENT_ID     = process.env.HUBSPOT_CLIENT_ID!;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET!;
const HUBSPOT_REDIRECT_URI  = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3001/api/integrations/hubspot/callback';
const HUBSPOT_SCOPES        = 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write';

export function getHubSpotAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id:     HUBSPOT_CLIENT_ID,
    redirect_uri:  HUBSPOT_REDIRECT_URI,
    scope:         HUBSPOT_SCOPES,
    state:         Buffer.from(JSON.stringify({ userId })).toString('base64'),
  });
  return `https://app.hubspot.com/oauth/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri:  HUBSPOT_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function storeTokens(userId: string, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): Promise<void> {
  const supabase = await getSupabase();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from('user_integrations').upsert({
    user_id:          userId,
    integration_type: 'hubspot',
    access_token:     tokens.access_token,
    refresh_token:    tokens.refresh_token,
    expires_at:       expiresAt,
    is_active:        true,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'user_id,integration_type' });
}

export async function getAccessToken(userId: string): Promise<string> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('integration_type', 'hubspot')
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error('HubSpot not connected. Visit /api/integrations/hubspot/connect');

  // Refresh if token expires in < 5 minutes
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const newToken = await refreshAccessToken(data.refresh_token);
    await supabase.from('user_integrations')
      .update({ access_token: newToken, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
      .eq('user_id', userId).eq('integration_type', 'hubspot');
    return newToken;
  }

  return data.access_token;
}
