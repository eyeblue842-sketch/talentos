import { createClient } from 'redis';
import { env } from './env.js';

let redisClient = null;
let redisConnectAttempted = false;

function createRedisClient() {
  return createClient({
    url: env.redisUrl,
    socket: {
      connectTimeout: env.redisConnectTimeoutMs,
      reconnectStrategy: () => false,
    },
  });
}

export function isRedisEnabled() {
  return env.redisEnabled && Boolean(env.redisUrl);
}

export function getRedisKey(key) {
  return `${env.redisKeyPrefix}:${key}`;
}

export async function getRedisClient({ connect = true } = {}) {
  if (!isRedisEnabled()) return null;

  if (!redisClient) {
    redisClient = createRedisClient();
    redisClient.on('error', (error) => {
      console.error(JSON.stringify({
        level: 'warn',
        event: 'redis.error',
        message: error?.message || 'Redis error',
      }));
    });
  }

  if (connect && !redisClient.isOpen && !redisConnectAttempted) {
    redisConnectAttempted = true;
    try {
      await redisClient.connect();
    } catch (error) {
      console.error(JSON.stringify({
        level: 'warn',
        event: 'redis.connect_failed',
        message: error?.message || 'Redis connection failed',
      }));
      redisConnectAttempted = false;
      return null;
    }
  }

  return redisClient.isOpen ? redisClient : null;
}

export async function closeRedisClient() {
  if (redisClient?.isOpen) {
    await redisClient.quit().catch(() => redisClient.disconnect());
  }
}

export async function getRedisHealth() {
  if (!isRedisEnabled()) {
    return { healthy: true, enabled: false, reason: 'Redis disabled.' };
  }

  const client = await getRedisClient();
  if (!client) {
    return { healthy: false, enabled: true, reason: 'Redis unavailable.' };
  }

  try {
    await client.ping();
    return { healthy: true, enabled: true };
  } catch (error) {
    return { healthy: false, enabled: true, reason: error.message };
  }
}
