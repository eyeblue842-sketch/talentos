import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

const resumeSearchUnavailableMessage = 'Resume search is temporarily unavailable.';

export function isElasticsearchEnabled() {
  return env.elasticsearchEnabled;
}

export function __resolveElasticConfig(config = {}) {
  const enabled = config.elasticsearchEnabled ?? isElasticsearchEnabled();
  const elasticsearchUrl = config.elasticsearchUrl ?? env.elasticsearchUrl;

  return {
    enabled,
    node: enabled ? elasticsearchUrl : null,
  };
}

const elasticConfig = __resolveElasticConfig();

export const elastic = elasticConfig.enabled
  ? new Client({ node: elasticConfig.node })
  : null;

export function createResumeSearchUnavailableError() {
  const error = new Error(resumeSearchUnavailableMessage);
  error.statusCode = 503;
  error.code = 'RESUME_SEARCH_UNAVAILABLE';
  return error;
}

export async function ensureResumeIndex() {
  if (!isElasticsearchEnabled()) return;
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
