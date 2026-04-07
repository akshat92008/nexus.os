/**
 * Agentic OS — Scheduler Engine
 *
 * Converts the one-shot DAG into a Living Execution Graph.
 * Supports time-based, data-change-based, and user-action-based triggers.
 *
 * Features:
 *   - scheduleWorkspace(): register a recurring mission
 *   - cancelSchedule(): remove a schedule
 *   - StaleDataDetector: auto-triggers when workspace data is >24h old
 *   - EventTriggerSystem: fires on user_action and external data changes
 */
export type TriggerType = 'time' | 'data_change' | 'user_action' | 'manual';
export type FrequencyType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
export interface ScheduleConfig {
    scheduleId: string;
    workspaceId: string;
    goal: string;
    userId: string;
    triggerType: TriggerType;
    frequency: FrequencyType;
    /** cron-like: ms interval for 'custom', or computed from frequency */
    intervalMs: number;
    lastRun: number | null;
    nextRun: number;
    enabled: boolean;
    createdAt: number;
    runCount: number;
    maxRuns?: number;
}
export interface ScheduleEvent {
    scheduleId: string;
    workspaceId: string;
    goal: string;
    userId: string;
    triggeredAt: number;
    triggerType: TriggerType;
}
type ScheduleCallback = (event: ScheduleEvent) => Promise<void>;
export declare function isDataStale(lastRunTimestamp: number | null): boolean;
declare class SchedulerEngine {
    private schedules;
    private callbacks;
    private tickInterval;
    private readonly TICK_MS;
    /**
     * Register a recurring execution on a workspace.
     */
    scheduleWorkspace(params: {
        workspaceId: string;
        goal: string;
        userId: string;
        frequency: FrequencyType;
        triggerType?: TriggerType;
        customIntervalMs?: number;
        maxRuns?: number;
    }): ScheduleConfig;
    /**
     * Cancel a schedule by ID.
     */
    cancelSchedule(scheduleId: string): boolean;
    /**
     * Cancel all schedules for a workspace.
     */
    cancelWorkspaceSchedules(workspaceId: string): number;
    /**
     * Pause a schedule without removing it.
     */
    pauseSchedule(scheduleId: string): void;
    resumeSchedule(scheduleId: string): void;
    /**
     * Register a callback to be called when a schedule fires.
     */
    onTrigger(cb: ScheduleCallback): void;
    /**
     * Manually trigger a schedule immediately.
     */
    triggerNow(scheduleId: string): Promise<void>;
    /**
     * Fire when user explicitly performs an action (user_action trigger).
     */
    notifyUserAction(workspaceId: string, actionType: string): Promise<void>;
    getSchedule(scheduleId: string): ScheduleConfig | undefined;
    listSchedules(): ScheduleConfig[];
    listWorkspaceSchedules(workspaceId: string): ScheduleConfig[];
    restoreSchedule(config: ScheduleConfig): void;
    start(): void;
    stop(): void;
    private tick;
    private fire;
    get stats(): {
        total: number;
        enabled: number;
        paused: number;
        upcoming: {
            scheduleId: string;
            nextRun: number;
            goal: string;
        }[];
    };
}
export declare const schedulerEngine: SchedulerEngine;
export {};
//# sourceMappingURL=scheduler.d.ts.map