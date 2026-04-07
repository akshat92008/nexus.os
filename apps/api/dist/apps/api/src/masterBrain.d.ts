/**
 * Agentic OS — Master Brain V2
 *
 * The central intelligence singleton that persists across ALL requests.
 * Unlike the old per-mission "planner", the Master Brain maintains global
 * awareness — tracking every running workspace, generating unsolicited
 * opportunities, detecting risks, and driving the 24/7 decision loop.
 */
import type { TaskDAG } from '../../../packages/types/index.js';
export type MissionLifecycleStatus = 'queued' | 'planning' | 'running' | 'paused' | 'complete' | 'failed' | 'scheduled';
export interface MissionState {
    missionId: string;
    workspaceId: string;
    goal: string;
    goalType: string;
    status: MissionLifecycleStatus;
    startedAt: number;
    completedAt?: number;
    dag?: TaskDAG;
    artifacts: Record<string, string>;
    nextActions: ScoredAction[];
    opportunities: Opportunity[];
    risks: Risk[];
}
export interface ScoredAction {
    id: string;
    title: string;
    description: string;
    type: 'execution' | 'review' | 'escalation' | 'integration';
    priority: 'critical' | 'high' | 'medium' | 'low';
    /** Priority Score = urgency(1-10) × impact(1-10) × feasibility(1-10) / 100 */
    score: number;
    workspaceId: string;
    createdAt: number;
    expiresAt?: number;
}
export interface Opportunity {
    id: string;
    title: string;
    description: string;
    sourceWorkspaceId: string;
    relatedWorkspaceIds: string[];
    score: number;
    createdAt: number;
}
export interface Risk {
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    workspaceId: string;
    createdAt: number;
    mitigations: string[];
}
export interface GlobalBrainState {
    missions: Map<string, MissionState>;
    globalActions: ScoredAction[];
    globalOpportunities: Opportunity[];
    globalRisks: Risk[];
    decisionCycle: number;
    lastEvaluatedAt: number;
}
export declare function scoreAction(params: {
    urgency: number;
    impact: number;
    feasibility: number;
}): number;
declare class MasterBrainV2 {
    private state;
    private loopInterval;
    private globalReflectionInterval;
    registerMission(missionId: string, workspaceId: string, goal: string, goalType?: string): MissionState;
    updateMissionStatus(missionId: string, status: MissionLifecycleStatus, dag?: TaskDAG): void;
    depositArtifact(missionId: string, taskId: string, content: string): void;
    pauseMission(missionId: string): void;
    resumeMission(missionId: string): void;
    getMissionState(missionId: string): MissionState | undefined;
    getAllMissions(): MissionState[];
    getActiveMissions(): MissionState[];
    scoreNextActions(workspaceId: string, rawActions: Array<{
        title: string;
        description: string;
        type: ScoredAction['type'];
        urgency: number;
        impact: number;
        feasibility: number;
    }>): ScoredAction[];
    private detectOpportunities;
    private detectRisks;
    private globalReflection;
    startDecisionLoop(intervalMs?: number): void;
    startGlobalReflection(intervalMs?: number): void;
    stopGlobalReflection(): void;
    stopDecisionLoop(): void;
    get globalState(): GlobalBrainState;
    get stats(): {
        totalMissions: number;
        activeMissions: number;
        queuedActions: number;
        opportunities: number;
        decisionCycles: number;
        lastEvaluatedAt: number;
    };
}
export declare const masterBrain: MasterBrainV2;
export {};
//# sourceMappingURL=masterBrain.d.ts.map