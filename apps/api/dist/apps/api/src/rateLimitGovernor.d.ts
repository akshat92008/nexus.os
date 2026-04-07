/**
 * Nexus OS — Rate Limit Governor
 *
 * A centralized concurrency controller for all Groq LLM calls.
 * Instead of each task managing its own retries independently
 * (the old model that caused cascading 429 storms), ALL Groq calls
 * flow through this governor.
 *
 * When any call hits a 429:
 *  1. The governor marks itself paused with a pauseUntil timestamp
 *  2. All other in-flight callers immediately yield at the pause gate
 *  3. After the window expires, calls resume in order
 *
 * This eliminates the pattern where 4 parallel tasks all retry at the
 * same time and all hit 429 again, doubling the wait each cycle.
 */
export declare class RateLimitGovernor {
    private paused;
    private pauseUntil;
    private running;
    private readonly concurrency;
    private queue;
    private fallbackModels;
    private recoveryQueue;
    /**
     * @param concurrency Max simultaneous Groq calls. 2 is safe for free tier.
     *                    Raise to 4–5 for paid plans with higher RPM limits.
     */
    constructor(concurrency?: number);
    /**
     * Execute an async function through the governor.
     * Handles: global rate-limit pause, concurrency limit, exponential backoff.
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private run;
    private callWithRetry;
    /**
     * Helper that injects a fallback model into a fetch payload if rate limits persist.
     * Can be used by tools to adapt payload if the governor advises a model switch.
     */
    getRecommendedModelUrlAndPayload(originalPayload: any, attemptCounter: number): any;
    private waitIfPaused;
    private drainQueue;
    private is429Error;
    private extractRetryAfter;
    get stats(): {
        running: number;
        queued: number;
        paused: boolean;
        pauseUntil: number;
        waitTime: number;
        recoveryWaveSize: number;
    };
}
//# sourceMappingURL=rateLimitGovernor.d.ts.map