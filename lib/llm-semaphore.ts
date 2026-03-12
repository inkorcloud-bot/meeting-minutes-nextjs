/**
 * LLM Semaphore - Concurrency Control for LLM Requests
 *
 * Provides a semaphore-based concurrency limiter to prevent overwhelming
 * the LLM API with too many simultaneous requests.
 *
 * Uses lazy initialization to ensure the semaphore is created after
 * the config module is fully loaded.
 */

import { config } from './config';

/**
 * Simple semaphore implementation for controlling concurrent access
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];
  private maxPermits: number;

  constructor(permits: number) {
    this.permits = permits;
    this.maxPermits = permits;
  }

  /**
   * Acquire a permit, waiting if necessary
   * Resolves when a permit is available
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // No permits available, wait in queue
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release a permit, allowing the next waiting request to proceed
   */
  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      // Wake up the next waiter (permit stays "used")
      next();
    } else {
      // No waiters, return the permit
      this.permits++;
    }
  }

  /**
   * Get current number of available permits
   */
  getAvailablePermits(): number {
    return this.permits;
  }

  /**
   * Get number of waiting requests
   */
  getQueueLength(): number {
    return this.waitQueue.length;
  }

  /**
   * Get maximum permits allowed
   */
  getMaxPermits(): number {
    return this.maxPermits;
  }
}

// Lazy-initialized semaphore instance
let _semaphore: Semaphore | null = null;

/**
 * Get the LLM semaphore instance (lazy initialization)
 * Creates the semaphore on first call with concurrency from config
 */
export function getLLMSemaphore(): Semaphore {
  if (!_semaphore) {
    _semaphore = new Semaphore(config.llmConcurrency);
    console.log(`[LLMSemaphore] Initialized with concurrency=${config.llmConcurrency}`);
  }
  return _semaphore;
}

/**
 * Reset the semaphore (useful for testing)
 * Creates a fresh semaphore with current config
 */
export function resetLLMSemaphore(): void {
  _semaphore = null;
  console.log('[LLMSemaphore] Reset');
}

/**
 * Execute an async function with semaphore protection
 * Automatically acquires and releases the semaphore
 *
 * @param fn - Async function to execute
 * @returns Result of the function
 */
export async function withLLMSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  const semaphore = getLLMSemaphore();
  const queueLength = semaphore.getQueueLength();

  if (queueLength > 0) {
    console.log(`[LLMSemaphore] Request waiting in queue (${queueLength} ahead)`);
  }

  await semaphore.acquire();
  console.log(`[LLMSemaphore] Acquired permit (available: ${semaphore.getAvailablePermits()}/${semaphore.getMaxPermits()})`);

  try {
    return await fn();
  } finally {
    semaphore.release();
    console.log(`[LLMSemaphore] Released permit (available: ${semaphore.getAvailablePermits()}/${semaphore.getMaxPermits()})`);
  }
}