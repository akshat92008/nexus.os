import { logger } from './logger.js';

interface RetryOptions {
  retries?: number;
  timeout?: number;
  initialDelay?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  timeout: 10000,
  initialDelay: 500,
};

/**
 * Native resilience utility to wrap external calls with retries and timeouts.
 * No external libraries used.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  options: RetryOptions = {}
): Promise<T> {
  const { retries, timeout, initialDelay } = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Timeout Logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Race the operation against the timeout
      // Note: only works if the operation supports AbortSignal or is a simple promise
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`[${label}] Timeout after ${timeout}ms`)), timeout)
        ),
      ]);

      clearTimeout(timeoutId);
      return result;

    } catch (err: any) {
      lastError = err;
      const isFinalAttempt = attempt === retries;

      if (!isFinalAttempt) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn(
          { label, attempt, nextRetryDelay: delay, error: err.message },
          `External call failure, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(
          { label, attempt, error: err.message },
          `External call failed after ${retries} attempts.`
        );
      }
    }
  }

  throw lastError;
}

/**
 * Specialized version for fetch calls
 */
export async function fetchWithResilience(
  url: string,
  options: RequestInit = {},
  resilienceOpts: RetryOptions = {}
): Promise<Response> {
  const { timeout = 10000 } = resilienceOpts;

  return withRetry(
    async () => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        return response;
      } finally {
        clearTimeout(id);
      }
    },
    `Fetch: ${url}`,
    resilienceOpts
  );
}
