/**
 * Token bucket, used to stay under someone else's published rate limit.
 *
 * Refills continuously rather than resetting on a fixed window, so a burst
 * cannot slip through at a window boundary. Empty bucket fails fast instead of
 * queueing: a user waiting 40 seconds for a food search would assume the app
 * is broken, and a queue that grows under load turns one slow request into
 * many.
 */
export class TokenBucket {
  constructor({ capacity, refillPerMinute, name = 'bucket' }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerMs = refillPerMinute / 60000;
    this.lastRefill = Date.now();
    this.name = name;
  }

  #refill() {
    const now = Date.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (now - this.lastRefill) * this.refillRatePerMs,
    );
    this.lastRefill = now;
  }

  /** True if a token was available and consumed. */
  tryTake() {
    this.#refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  /** Whole seconds until the next token, for a Retry-After header. */
  secondsUntilToken() {
    this.#refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRatePerMs / 1000);
  }
}
