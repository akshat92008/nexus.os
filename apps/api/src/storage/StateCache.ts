/**
 * NexusOS — State Cache Utility
 * 
 * High-performance, memory-efficient cache for mission states.
 * Can be backed by Redis in production for billionaire-scale multi-tenancy.
 */

export class StateCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  private readonly ttl: number;

  constructor(ttlMs: number = 3600_000) {
    this.ttl = ttlMs;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  values(): T[] {
    this.prune();
    return Array.from(this.cache.values()).map(e => e.data);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}
