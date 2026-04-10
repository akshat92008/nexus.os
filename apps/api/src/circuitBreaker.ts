// Simple circuit breaker using opossum for external API calls
import CircuitBreaker from 'opossum';

// Example: wrap a fetch call
export function createBreaker(action: (...args: any[]) => Promise<any>, options = {}) {
  return new CircuitBreaker(action, {
    timeout: 10000, // 10s
    errorThresholdPercentage: 50,
    resetTimeout: 30000, // 30s
    ...options,
  });
}

// Usage example:
// import { createBreaker } from './circuitBreaker';
// const breaker = createBreaker(() => fetch('https://api.example.com'));
// breaker.fire().then(...).catch(...);
