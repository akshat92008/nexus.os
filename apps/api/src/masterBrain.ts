/**
 * Agentic OS — Master Brain V2 (Durable & Stateless)
 *
 * The central intelligence singleton that persists across ALL requests.
 * Refactored to be stateless and triggered by BullMQ repeatable jobs.
 */

import { nexusStateStore } from './storage/nexusStateStore.js';
import { systemQueue } from './queue/queue.js';
import type { TaskDAG, OngoingMission } from '@nexus-os/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type MissionLifecycleStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'scheduled';

export interface ScoredAction {
  id:          string;
  title:       string;
  description: string;
  type:        'execution' | 'review' | 'escalation' | 'integration';
  priority:    'critical' | 'high' | 'medium' | 'low';
  score:       number;
  workspaceId: string;
  createdAt:   number;
}

export interface Opportunity {
  id:          string;
  title:       string;
  description: string;
  sourceWorkspaceId: string;
  relatedWorkspaceIds: string[];
  score:       number;
  createdAt:   number;
}

export interface Risk {
  id:          string;
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium' | 'low';
  workspaceId: string;
  createdAt:   number;
  mitigations: string[];
}

// ── Master Brain Singleton ────────────────────────────────────────────────────

class MasterBrainV2 {
  /**
   * Initializes the Master Brain's periodic loops using BullMQ.
   * This is called once during API server startup.
   */
  async initDurableLoops() {
    console.log('[MasterBrain] 🧠 Initializing Durable Decision Loops...');

    // 1. Decision Loop (Every 1 minute)
    await systemQueue.add(
      'master_brain_decision_loop',
      { type: 'master_brain_loop' },
      { 
        repeat: { pattern: '*/1 * * * *' },
        jobId: 'master_brain_decision_loop' 
      }
    );

    // 2. Global Reflection (Every 5 minutes)
    await systemQueue.add(
      'master_brain_reflection_loop',
      { type: 'master_brain_reflection' },
      { 
        repeat: { pattern: '*/5 * * * *' },
        jobId: 'master_brain_reflection_loop' 
      }
    );
  }

  /**
   * Performs a single decision cycle.
   * Triggered by systemWorker.
   */
  async runDecisionCycle() {
    console.log('[MasterBrain] 🧠 Running Decision Cycle...');
    
    // In a real refactor, this would:
    // 1. Fetch all active missions from DB
    // 2. Scan for stalled tasks (Risks)
    // 3. Score potential next actions
    // 4. Update user_states in Supabase with new insights
    
    // This makes the Master Brain horizontally scalable as any worker can run this.
  }

  /**
   * Performs global reflection across all missions.
   * Triggered by systemWorker.
   */
  async runGlobalReflection() {
    console.log('[MasterBrain] 🧠 Running Global Reflection...');
    // Implementation for cross-mission opportunity detection
  }
}

export const masterBrain = new MasterBrainV2();
// We no longer call start() here; the API server calls initDurableLoops() on startup.
