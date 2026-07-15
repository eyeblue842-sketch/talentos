import { env } from '../config/env.js';
import { apiError } from '../utils/response.js';

const buckets = new Map();

function cleanupExpired(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimiter({ keyPrefix, limit, windowMinutes = env.rateLimitWindowMinutes }) {
  const windowMs = windowMinutes * 60 * 1000;

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpired(now);

    const identity = `${req.ip}:${req.body?.email || req.params?.applicationId || 'anonymous'}`;
    const key = `${keyPrefix}:${identity}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json(apiError('Too many requests. Please try again later.'));
    }

    bucket.count += 1;
    return next();
  };
}
