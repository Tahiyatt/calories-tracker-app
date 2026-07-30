import { TokenBucket } from '../utils/rateLimiter.js';

/**
 * Per-user rate limiting on our own endpoints.
 *
 * Separate from the buckets guarding Open Food Facts, and necessary: those
 * protect OFF from us, this protects us from one user exhausting the shared
 * OFF allowance for everybody else.
 *
 * In-memory, so it resets on restart and does not work across multiple
 * instances. That is fine for a single deployed process; the moment this scales
 * horizontally it needs Redis — which is exactly what Phase 5 is about.
 */
export function rateLimit({ capacity, refillPerMinute, key = 'default' }) {
  const buckets = new Map();

  // Bound the map so a flood of distinct users cannot grow it forever.
  const MAX_TRACKED = 10000;

  return (req, res, next) => {
    const identity = `${key}:${req.user?._id ?? req.ip}`;

    if (!buckets.has(identity)) {
      if (buckets.size >= MAX_TRACKED) buckets.clear();
      buckets.set(identity, new TokenBucket({ capacity, refillPerMinute, name: identity }));
    }

    const bucket = buckets.get(identity);

    if (!bucket.tryTake()) {
      const retryAfter = bucket.secondsUntilToken();
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests — try again in ${retryAfter}s`,
      });
    }

    next();
  };
}
