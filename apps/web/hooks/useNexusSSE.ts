/**
 * Nexus OS — useNexusSSE Hook
 * 
 * Manages the full SSE lifecycle with 'Watchdog' resilience.
 * If 5 seconds pass without ANY activity (events or pings), 
 * the watchdog forces a reconnection to bypass half-open sockets.
 */

'use client';

import { useRef, useCallback, useState } from 'react';
import { useNexusStore } from '../store/nexusStore';
import type { NexusSSEEvent } from '@nexus-os/types';
import { createClient } from '../lib/supabase';
import { API_BASE, APP_CONFIG } from '../lib/constants';

const { MAX_RETRIES, BASE_DELAY } = APP_CONFIG;

async function streamSSE(
  input: RequestInfo | URL,
  init: RequestInit,
  ingestEvent: (event: NexusSSEEvent) => void,
  onOpen?: () => void
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(input, { ...init, headers, credentials: 'include' });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ error: 'Connection failed' }));
    ingestEvent({ type: 'error', message: err.error ?? 'Unknown error' });
    throw new Error(err.error ?? 'Connection failed');
  }

  onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      try {
        ingestEvent(JSON.parse(jsonStr) as NexusSSEEvent);
      } catch {
        // ignore malformed event payloads
      }
    }
  }
}

export async function runActionOrchestration(
  actionId: string,
  workspaceId: string,
  userId: string,
  ingestEvent: (event: NexusSSEEvent) => void,
  signal?: AbortSignal
) {
  await streamSSE(
    `/nexus-remote/execute-action`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, workspaceId, userId }),
      signal,
    },
    ingestEvent
  );
}

interface UseNexusSSEReturn {
  startOrchestration: (goal: string, userId: string, mode?: string) => Promise<void>;
  subscribeToMission: (missionId: string) => Promise<void>;
  startActionOrchestration: (actionId: string, workspaceId: string, userId: string) => Promise<void>;
  abort: () => void;
  status: 'connecting' | 'connected' | 'reconnecting' | 'failed';
  retryCount: number;
  manualRetry: () => void;
}

export function useNexusSSE(): UseNexusSSEReturn {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'failed'>('connected');
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(0);
  const activeMissionIdRef   = useRef<string | null>(null);
  const terminalStateRef     = useRef<boolean>(false); // stops reconnect after completed/failed
  
  const { ingestEvent, startSession, resetWorkspace } = useNexusStore();

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    clearRetryTimeout();
    // 🚨 FIX 6: Removed abortRef.current?.abort() from general cleanup
    // so that navigating away doesn't kill the background session.
    abortRef.current = null;
  }, [clearRetryTimeout]);

  const abort = useCallback(async () => {
    const missionId = activeMissionIdRef.current;
    cleanup();
    
    if (missionId) {
      console.log(`[SSE] 🛑 Aborting mission on server: ${missionId}`);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        await fetch(`/nexus-remote/missions/${missionId}/cancel`, { 
          method: 'POST',
          credentials: 'include',
          headers
        });
      } catch (err) {
        console.warn(`[SSE] Failed to send cancel signal to server for ${missionId}`, err);
      }
    }
  }, [cleanup]);

  const subscribeToMission = useCallback(
    async (missionId: string, attempt = 0) => {
      // Cleanup previous watchdog and abort existing requests
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }

      activeMissionIdRef.current = missionId;
      setRetryCount(attempt);
      setStatus(attempt > 0 ? 'reconnecting' : 'connecting');

      const controller = new AbortController();
      abortRef.current = controller;
      lastActivityRef.current = Date.now();

      watchdogRef.current = setInterval(() => {
        const silenceDuration = Date.now() - lastActivityRef.current;
        // Use the store's current state correctly
        const { session } = useNexusStore.getState();
        if (session.status === 'running' && silenceDuration > 120000) {
          console.warn(`[Watchdog] ⚠️ No mission activity for ${silenceDuration}ms. Reconnecting stream...`);
          // Clear current interval before recursing to prevent leaks
          if (watchdogRef.current) clearInterval(watchdogRef.current);
          void subscribeToMission(missionId, attempt + 1);
        }
      }, 5000);

      try {
        await streamSSE(
          `/nexus-remote/events/stream?missionId=${missionId}`,
          { signal: controller.signal },
          (event) => {
            lastActivityRef.current = Date.now();
            ingestEvent(event);
          },
          () => {
            setStatus('connected');
            setRetryCount(0);
          }
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const nextAttempt = attempt + 1;

        // Don't reconnect if mission already reached a terminal state
        if (terminalStateRef.current) {
          setStatus('connected'); // mission is done — no need to show 'failed'
          return;
        }

        if (nextAttempt > MAX_RETRIES) {
          setStatus('failed');
          setRetryCount(nextAttempt);
          return;
        }

        setStatus('reconnecting');
        setRetryCount(nextAttempt);
        const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 30000);
        retryTimeoutRef.current = setTimeout(() => {
          void subscribeToMission(missionId, nextAttempt);
        }, delay);
      }
    },
    [ingestEvent]
  );

  const connect = useCallback(() => {
    const missionId = activeMissionIdRef.current;
    clearRetryTimeout();
    setRetryCount(0);
    setStatus('connecting');
    if (missionId) {
      void subscribeToMission(missionId, 0);
    }
  }, [clearRetryTimeout, subscribeToMission]);

  const startOrchestration = useCallback(
    async (goal: string, mode = 'student') => {
      cleanup();
      setStatus('connecting');
      setRetryCount(0);
      
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        ingestEvent({ type: 'error', message: 'You must be signed in to start a mission' });
        return;
      }

      terminalStateRef.current = false; // reset for new mission
      startSession(goal, userId);

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/nexus-remote/orchestrate`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ goal: goal.trim(), mode }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Trigger failed' }));
          resetWorkspace(); // ← clear 'Mission in progress' bar on any API failure
          setStatus('connected');
          ingestEvent({ type: 'error', message: err.error ?? 'Orchestration trigger failed' });
          return;
        }

        const { missionId } = await response.json();
        console.log(`[SSE] 🚀 Mission triggered: ${missionId}. Subscribing to stream...`);
        void subscribeToMission(missionId);

      } catch (err: any) {
        resetWorkspace(); // ← clear 'Mission in progress' bar on network failure
        setStatus('connected');
        ingestEvent({
          type:    'error',
          message: err instanceof Error ? err.message : 'Network failure',
        });
      }
    },
    [cleanup, startSession, ingestEvent, subscribeToMission]
  );

  const startActionOrchestration = useCallback(
    async (actionId: string, workspaceId: string, userId: string) => {
      cleanup();
      
      const controller = new AbortController();
      abortRef.current = controller;
      lastActivityRef.current = Date.now();

      try {
        await runActionOrchestration(actionId, workspaceId, userId, (event) => {
          lastActivityRef.current = Date.now();
          ingestEvent(event);
        }, controller.signal);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        ingestEvent({
          type: 'error',
          message: err instanceof Error ? err.message : 'Action network failure',
        });
      } finally {
        abortRef.current = null;
      }
    },
    [cleanup, ingestEvent]
  );

  return { startOrchestration, subscribeToMission, startActionOrchestration, abort, status, retryCount, manualRetry: connect };
}
