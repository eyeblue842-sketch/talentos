import { getRedisClient, getRedisKey } from '../config/redis.js';

export async function getCachedJson(cacheKey) {
  const redisClient = await getRedisClient().catch(() => null);
  if (!redisClient) return null;
  const raw = await redisClient.get(getRedisKey(`cache:${cacheKey}`)).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setCachedJson(cacheKey, value, ttlSeconds = 60) {
  const redisClient = await getRedisClient().catch(() => null);
  if (!redisClient) return;
  await redisClient.set(getRedisKey(`cache:${cacheKey}`), JSON.stringify(value), {
    EX: ttlSeconds,
  }).catch(() => {});
}

export async function getOrSetCachedJson(cacheKey, resolver, ttlSeconds = 60) {
  const cached = await getCachedJson(cacheKey);
  if (cached) return { value: cached, cacheHit: true };
  const value = await resolver();
  await setCachedJson(cacheKey, value, ttlSeconds);
  return { value, cacheHit: false };
}
