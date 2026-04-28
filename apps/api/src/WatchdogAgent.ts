/**
 * Nexus OS — Watchdog Agent (Runtime Safety & Logical Audit)
 *
 * This module addresses "Logical Drift" by periodically auditing
 * the MissionMemory against the original mission goal.
 */

import type { MissionMemory } from './missionMemory.js';
import { llmRouter } from './llm/LLMRouter.js';
import { MODEL_POWER } from './agents/agentConfig.js';

export class WatchdogAgent {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private failStreaks: Map<string, number> = new Map();

  /**
   * Starts monitoring a specific mission.
   */
  startMonitoring(
    missionId: string,
    goal: string,
    memory: MissionMemory,
    onDriftDetected: (reason: string) => void
  ): void {
    console.log(`[Watchdog] 🛡️ Monitoring Mission: ${missionId}...`);

    this.failStreaks.set(missionId, 0);

    const monitor = async () => {
      const artifacts = memory.readAll();
      if (artifacts.length === 0) return;

      const recentContext = artifacts
        .slice(-3)
        .map((art) => `[Task: ${art.taskId}] Result: ${JSON.stringify(art.data).slice(0, 300)}...`)
        .join('\n\n');

      const prompt = `
        You are the NexusOS Watchdog Auditor.
        MISSION GOAL: "${goal}"
        
        RECENT MISSION PROGRESS:
        ${recentContext}

        AUDIT TASK:
        1. Is the current progress still logically aligned with the MISSION GOAL?
        2. Are there any internal contradictions between these recent findings?
        3. Is the agent "drifting" into irrelevant details or circular reasoning?

        Respond ONLY with a JSON object:
        {
          "status": "safe" | "drift_detected" | "contradiction_detected",
          "reason": "your explanation if status is not safe"
        }
      `;

      try {
        const res = await llmRouter.call({
          system: 'You are the NexusOS Watchdog Auditor.',
          user: prompt,
          model: MODEL_POWER,
          temperature: 0.1,
          maxTokens: 1000,
          jsonMode: true,
        });
        const audit = JSON.parse(res.content);
        if (audit.status !== 'safe') {
          console.warn(`[Watchdog] ALARM: ${audit.status} — ${audit.reason}`);
          onDriftDetected(audit.reason);
        }
        this.failStreaks.set(missionId, 0);
      } catch (err) {
        let failStreak = this.failStreaks.get(missionId) || 0;
        failStreak++;
        this.failStreaks.set(missionId, failStreak);
        console.warn('[Watchdog] Audit skipped for mission', missionId, ':', err);
      }

      const currentInterval = this.intervals.get(missionId);
      if (currentInterval) {
        clearInterval(currentInterval);
      }
      const failStreak = this.failStreaks.get(missionId) || 0;
      const newDelay = Math.min(30000 * Math.pow(2, failStreak), 300000);
      const newInterval = setInterval(monitor, newDelay);
      this.intervals.set(missionId, newInterval);
    };

    const interval = setInterval(monitor, 30000);
    this.intervals.set(missionId, interval);
  }

  /**
   * Stops monitoring a mission.
   */
  stopMonitoring(missionId: string): void {
    const interval = this.intervals.get(missionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(missionId);
      this.failStreaks.delete(missionId);
      console.log(`[Watchdog] 🛑 Stopped monitoring: ${missionId}`);
    }
  }
}

export const watchdogAgent = new WatchdogAgent();
