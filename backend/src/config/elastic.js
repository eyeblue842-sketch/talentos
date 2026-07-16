import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

export function __resolveElasticConfig(config = {}) {
  const inferredTestMode = process.env.NODE_ENV === 'test'
    || process.argv.some((arg) => arg.includes('node:test') || arg === '--test')
    || process.execArgv.includes('--test');
  const isTest = config.isTest ?? (env.isTest || inferredTestMode);
  const elasticsearchUrl = config.elasticsearchUrl ?? env.elasticsearchUrl;

  return {
    enabled: !isTest && Boolean(elasticsearchUrl),
    node: !isTest && elasticsearchUrl ? elasticsearchUrl : null,
  };
}

const elasticConfig = __resolveElasticConfig();

export const elastic = elasticConfig.enabled
  ? new Client({ node: elasticConfig.node })
  : null;

export async function ensureResumeIndex() {
  if (!elastic) return;
  const exists = await elastic.indices.exists({ index: env.elasticsearchIndex });
  if (exists) return;

  await elastic.indices.create({
    index: env.elasticsearchIndex,
    mappings: {
      properties: {
        fullName: { type: 'text' },
        headline: { type: 'text' },
        location: { type: 'keyword' },
        skills: { type: 'text' },
        totalExperience: { type: 'integer' },
        availability: { type: 'keyword' },
      },
    },
  });
}
