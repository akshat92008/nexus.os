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

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

import { getRedis } from './storage/redisClient.js'; 

interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface RecoveryItem<T> {
  fn: () => Promise<T>;
  attemptAt: number;
  failRecord: unknown;
  recoveryAttempts: number;
}

const MAX_RECOVERY_QUEUE_SIZE = 200;
const MAX_RECOVERY_ATTEMPTS = 3;
const DEFAULT_RECOVERY_DELAY_MS = 60_000;

export class RateLimitGovernor {
  private paused = false;
  private pauseUntil = 0;
  private running = 0;
  private readonly concurrency: number;
  private queue: Array<QueueItem<unknown>> = [];
  private readonly recoveryTimer: NodeJS.Timeout;

  // Token Bucket State
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRatePerMs: number;
  private lastRefill: number;

  // Load Balancer & Recovery Waves
  private fallbackModels = ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'];
  private recoveryQueue: Array<RecoveryItem<unknown>> = [];

  /**
   * @param concurrency Max simultaneous Groq calls.
   */
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    
    // Token Bucket: 10 tokens max, refill 1 token every 2 seconds (0.5 tokens/sec)
    this.maxTokens = 10;
    this.tokens = 10;
    this.refillRatePerMs = 1 / 2000; 
    this.lastRefill = Date.now();

    const redis = getRedis(); 
    console.log(`[Governor] Running in ${redis ? 'distributed (Redis)' : 'local (in-memory)'} mode`); 

    this.recoveryTimer = setInterval(() => {
      void this.drainRecoveryQueue();
    }, 5_000);
    this.recoveryTimer.unref?.();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRatePerMs;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  private async consumeToken(): Promise<void> {
    while (true) {
      this.refillTokens();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = (1 - this.tokens) / this.refillRatePerMs;
      await sleep(Math.min(waitMs, 2000));
    }
  }

  /**
   * Execute an async function through the governor.
   * Handles: global rate-limit pause, concurrency limit, token bucket, exponential backoff.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait out any global rate-limit pause first
    await this.waitIfPaused();

    // Concurrency gate — queue if at limit
    if (this.running >= this.concurrency) {
      return new Promise<T>((resolve, reject) => {
        this.queue.push({ fn, resolve, reject } as QueueItem<unknown>);
      });
    }

    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try {
      // Token bucket check
      await this.consumeToken();
      return await this.callWithRetry(fn, 0);
    } finally {
      this.running--;
      this.drainQueue();
    }
  }

  private async callWithRetry<T>(fn: () => Promise<T>, attempt: number): Promise<T> {
    const MAX_ATTEMPTS = 6;
    try {
      // Check global pause before each attempt
      await this.waitIfPaused();
      return await fn();
    } catch (err: unknown) {
      const is429 = this.is429Error(err);

      if (is429 && attempt < MAX_ATTEMPTS) {
        const retryAfterSecs = this.extractRetryAfter(err) ?? Math.pow(2, attempt + 1);
        // Add jitter to prevent thundering herd after the window
        const pauseMs = retryAfterSecs * 1000 + Math.random() * 2000;

        // GLOBAL pause — affects all concurrent callers, not just this one
        if (!this.paused || Date.now() + pauseMs > this.pauseUntil) {
          this.paused = true;
          this.pauseUntil = Date.now() + pauseMs;
          void this.syncPause(pauseMs); 
          console.warn(
            `[Governor] 🔴 Global pause ${Math.round(pauseMs / 1000)}s ` +
            `(attempt ${attempt + 1}/${MAX_ATTEMPTS})`
          );
        }

        await this.waitIfPaused();
        return this.callWithRetry(fn, attempt + 1);
      }

      if (is429 && attempt >= MAX_ATTEMPTS) {
        console.warn(`[Governor] 🌊 Task exhausted max retries. Moving to Recovery Wave.`);
        this.enqueueRecovery(fn, err);
        throw new Error(`[Governor] Moved to recovery wave due to persistent rate limits.`);
      }

      throw err;
    }
  }

  /**
   * Helper that injects a fallback model into a fetch payload if rate limits persist.
   * Can be used by tools to adapt payload if the governor advises a model switch.
   */
  getRecommendedModelUrlAndPayload(originalPayload: any, attemptCounter: number): any {
    const modelIdx = Math.min(Math.floor(attemptCounter / 2), this.fallbackModels.length - 1);
    return { ...originalPayload, model: this.fallbackModels[modelIdx] };
  }

  private async waitIfPaused(): Promise<void> {
    const redis = getRedis(); 
    if (redis) { 
      const val = await redis.get('nexus:governor:pauseUntil'); 
      if (val) { 
        const remoteUntil = parseInt(val); 
        if (remoteUntil > Date.now()) { 
          const wait = remoteUntil - Date.now(); 
          console.warn(`[Governor] Distributed pause active — waiting ${Math.round(wait/1000)}s`); 
          await sleep(wait); 
        } 
      } 
    } 

    if (!this.paused) return;
    const waitMs = this.pauseUntil - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    this.paused = false;
  }

  private async syncPause(pauseMs: number): Promise<void> { 
    const redis = getRedis(); 
    if (!redis) return; 
    const expiresAt = Date.now() + pauseMs; 
    const ttlSeconds = Math.ceil(pauseMs / 1000) + 5; 
    await redis.set('nexus:governor:pauseUntil', expiresAt, 'EX', ttlSeconds); 
  } 

  private drainQueue(): void {
    if (this.queue.length === 0 || this.running >= this.concurrency) return;
    const item = this.queue.shift()!;
    this.run(item.fn)
      .then(item.resolve)
      .catch(item.reject);
  }

  private enqueueRecovery<T>(fn: () => Promise<T>, failRecord: unknown, recoveryAttempts = 0): void {
    this.recoveryQueue.push({
      fn,
      attemptAt: Date.now() + DEFAULT_RECOVERY_DELAY_MS,
      failRecord,
      recoveryAttempts,
    } as RecoveryItem<unknown>);

    if (this.recoveryQueue.length > MAX_RECOVERY_QUEUE_SIZE) {
      const overflow = this.recoveryQueue.length - MAX_RECOVERY_QUEUE_SIZE;
      this.recoveryQueue.splice(0, overflow);
    }
  }

  private async drainRecoveryQueue(): Promise<void> {
    if (this.recoveryQueue.length === 0) return;

    const now = Date.now();
    const ready = this.recoveryQueue.filter((item) => item.attemptAt <= now);
    const pending = this.recoveryQueue.filter((item) => item.attemptAt > now);
    const readyToRun = ready.slice(0, this.concurrency);
    const deferredReady = ready.slice(this.concurrency).map((item) => ({
      ...item,
      attemptAt: now + 5_000,
    }));

    this.recoveryQueue = [...deferredReady, ...pending];

    if (readyToRun.length === 0) return;

    for (const item of readyToRun) {
      try {
        await this.execute(item.fn);
        console.warn('[Governor] Recovery wave successfully re-ran a deferred task.');
      } catch (err) {
        if (this.is429Error(err) && item.recoveryAttempts + 1 < MAX_RECOVERY_ATTEMPTS) {
          console.warn(
            `[Governor] Recovery task still rate limited. Re-queueing (attempt ${item.recoveryAttempts + 2}/${MAX_RECOVERY_ATTEMPTS}).`
          );
          this.enqueueRecovery(item.fn, err, item.recoveryAttempts + 1);
          continue;
        }

        console.error('[Governor] Recovery task failed permanently:', err ?? item.failRecord);
      }
    }
  }

  private is429Error(err: unknown): boolean {
    if (err instanceof Error) {
      return (
        err.message.includes('429') ||
        err.message.includes('rate_limit') ||
        err.message.includes('Too Many Requests')
      );
    }
    return false;
  }

  private extractRetryAfter(err: unknown): number | null {
    if (err instanceof Error) {
      const match = err.message.match(/retry.?after[:\s]+(\d+)/i);
      if (match) return parseInt(match[1]);
    }
    return null;
  }

  get stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      paused: this.paused,
      pauseUntil: this.pauseUntil,
      waitTime: this.paused ? Math.max(0, Math.round((this.pauseUntil - Date.now()) / 1000)) : 0,
      recoveryWaveSize: this.recoveryQueue.length,
    };
  }
}

let sharedGovernor: RateLimitGovernor | null = null;

export function getGlobalGovernor(): RateLimitGovernor {
  if (!sharedGovernor) {
    sharedGovernor = new RateLimitGovernor(
      parseInt(process.env.GROQ_GLOBAL_CONCURRENCY ?? '4', 10)
    );
  }

  return sharedGovernor;
}

export const globalGovernor = getGlobalGovernor();
