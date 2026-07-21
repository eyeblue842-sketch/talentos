import { prisma } from '../config/db.js';
import { elastic, isElasticsearchEnabled } from '../config/elastic.js';
import { getRedisHealth } from '../config/redis.js';
import { getIntelligenceProviderHealth } from '../intelligence/services/providerService.js';
import { getOrSetCachedJson } from './runtimeCacheService.js';

async function getDatabaseHealth() {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return { healthy: true };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

async function getElasticHealth() {
  if (!isElasticsearchEnabled()) {
    return { healthy: true, enabled: false, reason: 'Elasticsearch disabled.' };
  }

  try {
    await elastic.ping();
    return { healthy: true, enabled: true };
  } catch (error) {
    return { healthy: false, enabled: true, reason: error.message };
  }
}

async function getBackgroundTaskHealth() {
  try {
    const [pending, failed] = await Promise.all([
      prisma.backgroundTask.count({ where: { status: { in: ['PENDING', 'RUNNING', 'RETRYING'] } } }).catch(() => 0),
      prisma.backgroundTask.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER'] } } }).catch(() => 0),
    ]);
    return {
      healthy: true,
      pending,
      failed,
      mode: 'database-backed-worker',
    };
  } catch (error) {
    return { healthy: false, reason: error.message };
  }
}

export async function getApplicationHealth() {
  const { value } = await getOrSetCachedJson('health:application', async () => {
    const [database, elasticsearch, redis, intelligence, backgroundTasks] = await Promise.all([
      getDatabaseHealth(),
      getElasticHealth(),
      getRedisHealth(),
      getIntelligenceProviderHealth(),
      getBackgroundTaskHealth(),
    ]);

    const healthy = database.healthy && elasticsearch.healthy && redis.healthy;

    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'careeriz-api',
      database,
      elasticsearch,
      redis,
      intelligence,
      backgroundTasks,
    };
  }, 5);

  return value;
}
