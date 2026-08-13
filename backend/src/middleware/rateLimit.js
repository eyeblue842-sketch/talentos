import { env } from '../config/env.js';
import { getRedisClient, getRedisKey } from '../config/redis.js';
import { apiError } from '../utils/response.js';

const buckets = new Map();

export function resetRateLimiterBuckets() {
  buckets.clear();
}

function cleanupExpired(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimiter({ keyPrefix, limit, windowMinutes = env.rateLimitWindowMinutes, keyResolver } = {}) {
  const windowMs = windowMinutes * 60 * 1000;
  const maxRequests = limit || env.rateLimitMaxRequests;

  return async (req, res, next) => {
    const now = Date.now();
    const customIdentity = typeof keyResolver === 'function' ? keyResolver(req) : null;
    const identity = String(customIdentity || `${req.ip}:${req.body?.email || req.params?.applicationId || 'anonymous'}`);
    const key = `${keyPrefix}:${identity}`;
    const redisClient = await getRedisClient().catch(() => null);
    if (redisClient) {
      const redisKey = getRedisKey(`ratelimit:${key}`);
      try {
        const count = await redisClient.incr(redisKey);
        if (count === 1) {
          await redisClient.pExpire(redisKey, windowMs);
        }
        if (count > maxRequests) {
          const ttl = await redisClient.pTTL(redisKey);
          const retryAfter = ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(windowMs / 1000);
          res.setHeader('Retry-After', String(retryAfter));
          return res.status(429).json(apiError('Too many requests. Please try again later.'));
        }
        return next();
      } catch {
        // Fall through to in-memory protection when Redis is unavailable.
      }
    }

    cleanupExpired(now);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json(apiError('Too many requests. Please try again later.'));
    }

    bucket.count += 1;
    return next();
  };
}
