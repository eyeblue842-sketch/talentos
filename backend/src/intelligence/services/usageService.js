import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { intelligenceUsageLimits } from '../policies/intelligencePolicy.js';

function getFeatureLimitConfig(feature) {
  return intelligenceUsageLimits.featureOverrides[feature] || {};
}

export function assertIntelligenceInputLength(value = '') {
  if (String(value || '').length > env.intelligenceMaxInputChars) {
    const error = new Error('Intelligence input is too large for this request.');
    error.code = 'INTELLIGENCE_INPUT_TOO_LARGE';
    error.statusCode = 422;
    throw error;
  }
}

export async function enforceIntelligenceUsageLimits({ organisationId, userId, feature, batchSize = 1 }) {
  if (batchSize > intelligenceUsageLimits.maxBatchSize) {
    const error = new Error(`Batch size exceeds the current limit of ${intelligenceUsageLimits.maxBatchSize}.`);
    error.code = 'INTELLIGENCE_BATCH_LIMIT_EXCEEDED';
    error.statusCode = 429;
    throw error;
  }

  const limitConfig = getFeatureLimitConfig(feature);
  const perUserPerDay = limitConfig.perUserPerDay || intelligenceUsageLimits.defaultPerUserPerDay;
  const perOrganisationPerDay = limitConfig.perOrganisationPerDay || intelligenceUsageLimits.defaultPerOrganisationPerDay;
  const since = new Date(Date.now() - (24 * 60 * 60 * 1000));

  const [userCount, organisationCount] = await Promise.all([
    prisma.intelligenceExecution.count({
      where: {
        organisationId,
        requestedByUserId: userId,
        feature,
        createdAt: { gte: since },
      },
    }),
    prisma.intelligenceExecution.count({
      where: {
        organisationId,
        feature,
        createdAt: { gte: since },
      },
    }),
  ]);

  if (userCount >= perUserPerDay) {
    const error = new Error('You have reached the current daily limit for this intelligence feature.');
    error.code = 'INTELLIGENCE_USER_LIMIT_EXCEEDED';
    error.statusCode = 429;
    throw error;
  }

  if (organisationCount >= perOrganisationPerDay) {
    const error = new Error('Your organization has reached the current daily limit for this intelligence feature.');
    error.code = 'INTELLIGENCE_ORG_LIMIT_EXCEEDED';
    error.statusCode = 429;
    throw error;
  }
}
