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
// ── Frequency to Interval Map ────────────────────────────────────────────────
const FREQUENCY_MS = {
    hourly: 1_000 * 60 * 60,
    daily: 1_000 * 60 * 60 * 24,
    weekly: 1_000 * 60 * 60 * 24 * 7,
    monthly: 1_000 * 60 * 60 * 24 * 30,
    custom: 1_000 * 60 * 60, // default, overridden by user
};
// ── Stale Data Detector ──────────────────────────────────────────────────────
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
export function isDataStale(lastRunTimestamp) {
    if (!lastRunTimestamp)
        return true;
    return Date.now() - lastRunTimestamp > STALE_THRESHOLD_MS;
}
// ── Scheduler Engine ──────────────────────────────────────────────────────────
class SchedulerEngine {
    schedules = new Map();
    callbacks = [];
    tickInterval = null;
    TICK_MS = 30_000; // Evaluate every 30 seconds
    // ── Public API ──────────────────────────────────────────────────────────────
    /**
     * Register a recurring execution on a workspace.
     */
    scheduleWorkspace(params) {
        const scheduleId = `sched_${crypto.randomUUID().slice(0, 10)}`;
        const intervalMs = params.customIntervalMs ?? FREQUENCY_MS[params.frequency];
        const now = Date.now();
        const config = {
            scheduleId,
            workspaceId: params.workspaceId,
            goal: params.goal,
            userId: params.userId,
            triggerType: params.triggerType ?? 'time',
            frequency: params.frequency,
            intervalMs,
            lastRun: null,
            nextRun: now + intervalMs,
            enabled: true,
            createdAt: now,
            runCount: 0,
            maxRuns: params.maxRuns,
        };
        this.schedules.set(scheduleId, config);
        console.log(`[Scheduler] ⏰ Registered: ${scheduleId} (${params.frequency}) → ws:${params.workspaceId}`);
        return config;
    }
    /**
     * Cancel a schedule by ID.
     */
    cancelSchedule(scheduleId) {
        const existed = this.schedules.has(scheduleId);
        this.schedules.delete(scheduleId);
        if (existed)
            console.log(`[Scheduler] ❌ Cancelled: ${scheduleId}`);
        return existed;
    }
    /**
     * Cancel all schedules for a workspace.
     */
    cancelWorkspaceSchedules(workspaceId) {
        let count = 0;
        for (const [id, sched] of this.schedules) {
            if (sched.workspaceId === workspaceId) {
                this.schedules.delete(id);
                count++;
            }
        }
        return count;
    }
    /**
     * Pause a schedule without removing it.
     */
    pauseSchedule(scheduleId) {
        const sched = this.schedules.get(scheduleId);
        if (sched)
            sched.enabled = false;
    }
    resumeSchedule(scheduleId) {
        const sched = this.schedules.get(scheduleId);
        if (sched) {
            sched.enabled = true;
            sched.nextRun = Date.now() + sched.intervalMs;
        }
    }
    /**
     * Register a callback to be called when a schedule fires.
     */
    onTrigger(cb) {
        this.callbacks.push(cb);
    }
    /**
     * Manually trigger a schedule immediately.
     */
    async triggerNow(scheduleId) {
        const sched = this.schedules.get(scheduleId);
        if (!sched)
            throw new Error(`Schedule ${scheduleId} not found`);
        await this.fire(sched, 'manual');
    }
    /**
     * Fire when user explicitly performs an action (user_action trigger).
     */
    async notifyUserAction(workspaceId, actionType) {
        for (const sched of this.schedules.values()) {
            if (sched.workspaceId === workspaceId && sched.triggerType === 'user_action' && sched.enabled) {
                console.log(`[Scheduler] 👆 User action "${actionType}" triggered schedule ${sched.scheduleId}`);
                await this.fire(sched, 'user_action');
            }
        }
    }
    getSchedule(scheduleId) {
        return this.schedules.get(scheduleId);
    }
    listSchedules() {
        return Array.from(this.schedules.values());
    }
    listWorkspaceSchedules(workspaceId) {
        return this.listSchedules().filter(s => s.workspaceId === workspaceId);
    }
    restoreSchedule(config) {
        this.schedules.set(config.scheduleId, { ...config });
    }
    // ── Internal Tick ───────────────────────────────────────────────────────────
    start() {
        if (this.tickInterval)
            return;
        console.log(`[Scheduler] 🚀 Engine started (tick: ${this.TICK_MS}ms)`);
        this.tickInterval = setInterval(() => this.tick(), this.TICK_MS);
    }
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }
    async tick() {
        const now = Date.now();
        for (const sched of this.schedules.values()) {
            if (!sched.enabled)
                continue;
            if (now < sched.nextRun)
                continue;
            if (sched.maxRuns && sched.runCount >= sched.maxRuns) {
                sched.enabled = false;
                continue;
            }
            await this.fire(sched, sched.triggerType);
        }
    }
    async fire(sched, triggerType) {
        const now = Date.now();
        sched.lastRun = now;
        sched.nextRun = now + sched.intervalMs;
        sched.runCount++;
        const event = {
            scheduleId: sched.scheduleId,
            workspaceId: sched.workspaceId,
            goal: sched.goal,
            userId: sched.userId,
            triggeredAt: now,
            triggerType,
        };
        console.log(`[Scheduler] 🔥 Firing ${sched.scheduleId} (#${sched.runCount}) — "${sched.goal.slice(0, 40)}"`);
        for (const cb of this.callbacks) {
            try {
                await cb(event);
            }
            catch (err) {
                console.error(`[Scheduler] Callback error:`, err);
            }
        }
    }
    get stats() {
        const schedules = this.listSchedules();
        return {
            total: schedules.length,
            enabled: schedules.filter(s => s.enabled).length,
            paused: schedules.filter(s => !s.enabled).length,
            upcoming: schedules
                .filter(s => s.enabled)
                .sort((a, b) => a.nextRun - b.nextRun)
                .slice(0, 5)
                .map(s => ({ scheduleId: s.scheduleId, nextRun: s.nextRun, goal: s.goal.slice(0, 40) })),
        };
    }
}
// ── Export Singleton ──────────────────────────────────────────────────────────
export const schedulerEngine = new SchedulerEngine();
schedulerEngine.start();
//# sourceMappingURL=scheduler.js.map