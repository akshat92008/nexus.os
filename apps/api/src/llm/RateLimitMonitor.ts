/**
 * Nexus OS — Rate Limit Monitor
 *
 * Tracks rate limit status across all LLM providers.
 * Provides insights into provider availability and optimal routing.
 */

interface RateLimitEvent {
  provider: string;
  model: string;
  timestamp: number;
  retryAfter?: number;
  error: string;
}

interface ProviderStatus {
  provider: string;
  isRateLimited: boolean;
  lastRateLimit: number;
  retryAfter: number;
  totalRateLimits: number;
  successCount: number;
  failureCount: number;
  healthScore: number; // 0-100, starts at 100
  consecutiveFailures: number;
}

export class RateLimitMonitor {
  private events: RateLimitEvent[] = [];
  private providerStats = new Map<string, ProviderStatus>();
  private readonly maxEvents = 1000;

  /**
   * Record a rate limit event
   */
  recordRateLimit(provider: string, model: string, retryAfter?: number, error?: string): void {
    const event: RateLimitEvent = {
      provider,
      model,
      timestamp: Date.now(),
      retryAfter,
      error: error || 'Rate limited',
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift(); // Remove oldest
    }

    // Update provider stats
    const key = `${provider}:${model}`;
    let stats = this.providerStats.get(key);
    if (!stats) {
      stats = {
        provider,
        isRateLimited: true,
        lastRateLimit: event.timestamp,
        retryAfter: retryAfter || 60,
        totalRateLimits: 0,
        successCount: 0,
        failureCount: 0,
        healthScore: 70, // Start lower if first hit is a limit
        consecutiveFailures: 1,
      };
      this.providerStats.set(key, stats);
    }

    stats.totalRateLimits++;
    stats.lastRateLimit = event.timestamp;
    stats.retryAfter = retryAfter || 60;
    stats.isRateLimited = true;
    stats.consecutiveFailures++;
    
    // Hard penalty for rate limit
    stats.healthScore = Math.max(0, stats.healthScore - 40);

    console.warn(`[RateLimitMonitor] ${provider} ${model} rate limited. Health Score: ${stats.healthScore}. Retry after: ${retryAfter}s`);
  }

  /**
   * Record a successful call
   */
  recordSuccess(provider: string, model: string): void {
    const key = `${provider}:${model}`;
    let stats = this.providerStats.get(key);
    if (!stats) {
      stats = {
        provider,
        isRateLimited: false,
        lastRateLimit: 0,
        retryAfter: 0,
        totalRateLimits: 0,
        successCount: 0,
        failureCount: 0,
        healthScore: 100,
        consecutiveFailures: 0,
      };
      this.providerStats.set(key, stats);
    }

    stats.successCount++;
    stats.consecutiveFailures = 0;
    stats.isRateLimited = false;
    // Gradually recover health
    stats.healthScore = Math.min(100, stats.healthScore + 2);
  }

  /**
   * Record a failed call (non-rate-limit)
   */
  recordFailure(provider: string, model: string): void {
    const key = `${provider}:${model}`;
    let stats = this.providerStats.get(key);
    if (!stats) {
      stats = {
        provider,
        isRateLimited: false,
        lastRateLimit: 0,
        retryAfter: 0,
        totalRateLimits: 0,
        successCount: 0,
        failureCount: 0,
        healthScore: 90,
        consecutiveFailures: 1,
      };
      this.providerStats.set(key, stats);
    }

    stats.failureCount++;
    stats.consecutiveFailures++;
    // Moderate penalty for general failure
    stats.healthScore = Math.max(0, stats.healthScore - 10);
  }

  /**
   * Check if a provider/model is currently rate limited
   */
  isRateLimited(provider: string, model: string): boolean {
    const key = `${provider}:${model}`;
    const stats = this.providerStats.get(key);
    if (!stats) return false;

    if (!stats.isRateLimited) return false;

    // Check if retry period has passed
    const timeSinceLimit = Date.now() - stats.lastRateLimit;
    if (timeSinceLimit > stats.retryAfter * 1000) {
      stats.isRateLimited = false;
      return false;
    }

    return true;
  }

  /**
   * Get current health score for a model (0-100)
   */
  getHealthScore(provider: string, model: string): number {
    const key = `${provider}:${model}`;
    const stats = this.providerStats.get(key);
    return stats ? stats.healthScore : 100;
  }

  /**
   * Get status for all providers
   */
  getAllStatuses(): ProviderStatus[] {
    return Array.from(this.providerStats.values());
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 50): RateLimitEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get health summary
   */
  getHealthSummary(): { totalProviders: number; rateLimitedCount: number; totalEvents: number } {
    const rateLimitedCount = Array.from(this.providerStats.values()).filter(s => s.isRateLimited).length;
    return {
      totalProviders: this.providerStats.size,
      rateLimitedCount,
      totalEvents: this.events.length,
    };
  }
}

export const rateLimitMonitor = new RateLimitMonitor();