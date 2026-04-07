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

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  startActionOrchestration: (actionId: string, workspaceId: string, userId: string) => Promise<void>;
  abort: () => void;
}

export function useNexusSSE(): UseNexusSSEReturn {
  const abortRef   = useRef<AbortController | null>(null);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(0);
  
  const { ingestEvent, startSession } = useNexusStore();

  const abort = useCallback(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const startOrchestration = useCallback(
    async (goal: string, userId: string, mode = 'student', retryCount = 0) => {
      if (retryCount === 0) {
        abort();
        startSession(goal, userId);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      lastActivityRef.current = Date.now();

      // watchdog timer: Check for silence every 2 seconds
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      watchdogRef.current = setInterval(() => {
        const silenceDuration = Date.now() - lastActivityRef.current;
        const state = useNexusStore.getState();
        const status = state.session.status;
        const isPaused = state.session.systemPauseUntil !== null;
        
        // Only force reconnect if NOT paused and silence duration exceeds threshold
        if ((status === 'routing' || status === 'running') && !isPaused && silenceDuration > 6000) {
          console.warn(`[Watchdog] ⚠️ No activity for ${silenceDuration}ms (and not paused). Forcing reconnect...`);
          startOrchestration(goal, userId, mode, retryCount + 1);
        }
      }, 2000);

      try {
        const response = await fetch(`${API_BASE}/api/orchestrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: goal.trim(), userId, mode }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({ error: 'Connection failed' }));
          ingestEvent({ type: 'error', message: err.error ?? 'Unknown error' });
          return;
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';

        const processChunk = (chunk: string) => {
          lastActivityRef.current = Date.now(); // Track that we actually got bytes
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr) as NexusSSEEvent;
              // Update activity on valid events too
              lastActivityRef.current = Date.now();
              ingestEvent(event);
            } catch (e) {
              // Ignore parse errors on whitespace pings
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            const currentState = useNexusStore.getState().session.status;
            if ((currentState === 'routing' || currentState === 'running') && retryCount < 3) {
              console.warn(`[SSE] Stream ended. Retrying (${retryCount + 1}/3)...`);
              setTimeout(() => startOrchestration(goal, userId, mode, retryCount + 1), 1000);
            }
            break;
          }
          processChunk(decoder.decode(value, { stream: true }));
        }

      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (retryCount < 3) {
          setTimeout(() => startOrchestration(goal, userId, mode, retryCount + 1), 1500);
        } else {
          ingestEvent({
            type:    'error',
            message: err instanceof Error ? err.message : 'Network failure',
          });
        }
      } finally {
        if (retryCount >= 3) {
            if (watchdogRef.current) clearInterval(watchdogRef.current);
            abortRef.current = null;
        }
      }
    },
    [abort, startSession, ingestEvent]
  );

  const startActionOrchestration = useCallback(
    async (actionId: string, workspaceId: string, userId: string) => {
      abort();
      
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
    [abort, ingestEvent]
  );

  return { startOrchestration, startActionOrchestration, abort };
}
