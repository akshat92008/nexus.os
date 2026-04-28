import { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase';

/**
 * Desktop Auth Hook
 * Bridges Supabase auth with Tauri desktop sessions.
 * On desktop: uses PKCE flow via system browser, then deep-link back.
 * On web: standard Supabase auth.
 */
export function useDesktopAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithOAuth = async (provider: 'google' | 'github' | 'apple') => {
    // Desktop: opens system browser with PKCE
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: true, // Let Tauri handle the callback
        redirectTo: 'nexus://auth/callback'
      }
    });
    if (error) throw error;

    // On desktop, open the URL via Tauri shell
    if (data?.url && typeof window !== 'undefined' && (window as any).__TAURI__) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(data.url);
    } else if (data?.url) {
      window.location.href = data.url;
    }
  };

  return { user, loading, signIn, signUp, signOut, signInWithOAuth };
}
