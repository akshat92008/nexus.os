/**
 * Nexus OS — Watchdog Agent (Runtime Safety & Logical Audit)
 *
 * This module addresses "Logical Drift" by periodically auditing
 * the MissionMemory against the original mission goal.
 */
import type { MissionMemory } from './missionMemory.js';
export declare class WatchdogAgent {
    private intervals;
    /**
     * Starts monitoring a specific mission.
     */
    startMonitoring(missionId: string, goal: string, memory: MissionMemory, onDriftDetected: (reason: string) => void): void;
    /**
     * Stops monitoring a mission.
     */
    stopMonitoring(missionId: string): void;
}
export declare const watchdogAgent: WatchdogAgent;
//# sourceMappingURL=WatchdogAgent.d.ts.map