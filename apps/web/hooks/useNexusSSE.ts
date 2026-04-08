/**
 * Nexus OS — useNexusSSE Hook
 * 
 * Manages the full SSE lifecycle with 'Watchdog' resilience.
 * If 5 seconds pass without ANY activity (events or pings), 
 * the watchdog forces a reconnection to bypass half-open sockets.
 */

'use client';

import { useRef, useCallback } from 'react';
import { useNexusStore } from '../store/nexusStore';
import type { NexusSSEEvent } from '@nexus-os/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:3001');

async function streamSSE(
  input: RequestInfo | URL,
  init: RequestInit,
  ingestEvent: (event: NexusSSEEvent) => void
) {
  const response = await fetch(input, init);

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({ error: 'Connection failed' }));
    ingestEvent({ type: 'error', message: err.error ?? 'Unknown error' });
    return;
  }

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
      } catch {}
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
    `${API_BASE}/api/execute-action`,
    {
      method: 'POST',
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
}

export function useNexusSSE(): UseNexusSSEReturn {
  const abortRef   = useRef<AbortController | null>(null);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(0);
  const activeMissionIdRef = useRef<string | null>(null);
  
  const { ingestEvent, startSession } = useNexusStore();

  const cleanup = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const abort = useCallback(async () => {
    const missionId = activeMissionIdRef.current;
    cleanup();
    
    if (missionId) {
      console.log(`[SSE] 🛑 Aborting mission on server: ${missionId}`);
      try {
        await fetch(`${API_BASE}/api/missions/${missionId}/cancel`, { method: 'POST' });
      } catch (err) {
        console.warn(`[SSE] Failed to send cancel signal to server for ${missionId}`, err);
      }
    }
  }, [cleanup]);

  /**
   * Persistent Subscription: Reconnects to a mission's event stream
   */
  const subscribeToMission = useCallback(
    async (missionId: string, retryCount = 0) => {
      activeMissionIdRef.current = missionId;
      const controller = new AbortController();
      abortRef.current = controller;
      lastActivityRef.current = Date.now();

      // watchdog timer
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      watchdogRef.current = setInterval(() => {
        const silenceDuration = Date.now() - lastActivityRef.current;
        const state = useNexusStore.getState();
        if (state.session.status === 'running' && silenceDuration > 10000) {
          console.warn(`[Watchdog] ⚠️ No mission activity for ${silenceDuration}ms. Reconnecting stream...`);
          subscribeToMission(missionId, retryCount + 1);
        }
      }, 5000);

      try {
        await streamSSE(
          `${API_BASE}/api/events/stream?missionId=${missionId}`,
          { signal: controller.signal },
          (event) => {
            lastActivityRef.current = Date.now();
            ingestEvent(event);
          }
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (retryCount < 5) {
          setTimeout(() => subscribeToMission(missionId, retryCount + 1), 2000);
        }
      }
    },
    [ingestEvent]
  );

  const startOrchestration = useCallback(
    async (goal: string, userId: string, mode = 'student') => {
      cleanup();
      startSession(goal, userId);

      try {
        const response = await fetch(`${API_BASE}/api/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: goal.trim(), userId, mode }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Trigger failed' }));
          ingestEvent({ type: 'error', message: err.error ?? 'Orchestration trigger failed' });
          return;
        }

        const { missionId } = await response.json();
        console.log(`[SSE] 🚀 Mission triggered: ${missionId}. Subscribing to stream...`);
        subscribeToMission(missionId);

      } catch (err: any) {
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

  return { startOrchestration, subscribeToMission, startActionOrchestration, abort };
}
