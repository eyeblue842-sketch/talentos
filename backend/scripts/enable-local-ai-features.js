import { prisma, closePrisma } from '../src/config/db.js';

const featureKeys = [
  'intelligence.resume_summary',
  'intelligence.skill_extraction',
  'intelligence.candidate_matching',
  'intelligence.candidate_ranking',
  'intelligence.match_overrides',
  'intelligence.match_scoring_profiles',
  'intelligence.candidate_intelligence',
  'intelligence.job_description',
  'intelligence.interview_assistant',
  'intelligence.talent_search',
  'intelligence.semantic_search',
  'intelligence.semantic_search_expansion',
  'intelligence.search_history',
  'intelligence.search_suggestions',
  'intelligence.analytics_insights',
];

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const organisationId = getArgValue('--organisationId');
  const organisations = organisationId
    ? [{ id: organisationId }]
    : await prisma.organisation.findMany({ select: { id: true } });

  for (const organisation of organisations) {
    for (const key of featureKeys) {
      await prisma.organisationFeature.upsert({
        where: {
          organisationId_key: {
            organisationId: organisation.id,
            key,
          },
        },
        create: {
          organisationId: organisation.id,
          key,
          description: `Local AI enablement for ${key}`,
          enabled: true,
        },
        update: {
          enabled: true,
        },
      });
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    event: 'ai.local-features.enabled',
    organisationCount: organisations.length,
    featureCount: featureKeys.length,
    organisationId: organisationId || null,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'ai.local-features.failed',
      code: error?.code || 'AI_LOCAL_FEATURE_ENABLE_FAILED',
      message: error?.message || 'Unable to enable local AI features.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrisma().catch(() => {});
  });
