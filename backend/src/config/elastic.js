import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

export const elastic = env.elasticsearchUrl
  ? new Client({ node: env.elasticsearchUrl })
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
