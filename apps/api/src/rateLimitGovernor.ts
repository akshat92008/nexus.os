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

interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

export class RateLimitGovernor {
  private paused = false;
  private pauseUntil = 0;
  private running = 0;
  private readonly concurrency: number;
  private queue: Array<QueueItem<unknown>> = [];

  // Load Balancer & Recovery Waves
  private fallbackModels = ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'];
  private recoveryQueue: Array<{ fn: () => Promise<unknown>, attemptAt: number, failRecord: any }> = [];

  /**
   * @param concurrency Max simultaneous Groq calls. 2 is safe for free tier.
   *                    Raise to 4–5 for paid plans with higher RPM limits.
   */
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  /**
   * Execute an async function through the governor.
   * Handles: global rate-limit pause, concurrency limit, exponential backoff.
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
        this.recoveryQueue.push({ fn, attemptAt: Date.now() + 60000, failRecord: err });
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
    if (!this.paused) return;
    const waitMs = this.pauseUntil - Date.now();
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    this.paused = false;
  }

  private drainQueue(): void {
    if (this.queue.length === 0 || this.running >= this.concurrency) return;
    const item = this.queue.shift()!;
    this.run(item.fn)
      .then(item.resolve)
      .catch(item.reject);
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
