import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

export function __resolveElasticConfig(config = {}) {
  const isTest = config.isTest ?? env.isTest;
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
