import { app } from './app.js';
import { env } from './config/env.js';
import { ensureResumeIndex, isElasticsearchEnabled } from './config/elastic.js';
import { getRedisClient, isRedisEnabled } from './config/redis.js';
import { pathToFileURL } from 'url';
import { getSafeIntelligenceRuntimeConfiguration, getSafeResumeAiConfiguration } from './intelligence/services/runtimeConfigurationService.js';

export function createServerStarter({
  application = app,
  runtimeEnv = env,
  ensureResumeIndexFn = ensureResumeIndex,
  elasticsearchEnabled = isElasticsearchEnabled,
  redisEnabled = isRedisEnabled,
  connectRedis = getRedisClient,
  logger = console,
  exit = (code) => process.exit(code),
} = {}) {
  return async function start() {
    try {
      if (redisEnabled()) {
        await connectRedis().catch((error) => {
          logger.warn('Redis is unavailable. Falling back to degraded runtime behavior.', error);
        });
      }

      if (elasticsearchEnabled()) {
        await ensureResumeIndexFn();
      } else {
        logger.warn('Elasticsearch is disabled. Resume search functionality is unavailable.');
      }

      logger.log(JSON.stringify({
        level: 'info',
        event: 'ai.runtime.configuration',
        service: 'api',
        ...getSafeIntelligenceRuntimeConfiguration(),
      }));
      logger.log(JSON.stringify({
        level: 'info',
        event: 'resume.ai.configuration',
        service: 'api',
        ...getSafeResumeAiConfiguration(),
      }));

      return application.listen(runtimeEnv.port, () => {
        logger.log(`Careeriz API running on port ${runtimeEnv.port}`);
      });
    } catch (error) {
      logger.error('Failed to start server', error);
      exit(1);
      return null;
    }
  };
}

export const start = createServerStarter();

const isDirectExecution = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isDirectExecution) {
  start();
}
