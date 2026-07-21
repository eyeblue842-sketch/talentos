import { prisma } from '../../config/db.js';
import { requireEnterprisePermission } from '../../services/enterprisePermissionService.js';
import { getIntelligenceProviderHealth } from './providerService.js';
import { listPromptDefinitions } from '../prompts/promptRegistry.js';

export async function getIntelligenceGovernanceDashboard(actorUser, filters = {}) {
  const context = await requireEnterprisePermission(actorUser, 'intelligence.governance.read', filters.organisationId || null);
  const providerHealth = await getIntelligenceProviderHealth();
  const [executionCounts, recentExecutions, failures, feedbackSummary] = await Promise.all([
    prisma.intelligenceExecution.groupBy({
      by: ['feature', 'status'],
      where: { organisationId: context.organisationId },
      _count: { _all: true },
    }),
    prisma.intelligenceExecution.findMany({
      where: { organisationId: context.organisationId },
      include: { feedback: true, results: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.intelligenceExecution.count({
      where: {
        organisationId: context.organisationId,
        status: 'FAILED',
      },
    }),
    prisma.intelligenceFeedback.aggregate({
      where: {
        execution: { organisationId: context.organisationId },
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return {
    providerHealth,
    executionCounts,
    failures,
    feedbackSummary: {
      averageRating: feedbackSummary._avg.rating ? Number(feedbackSummary._avg.rating.toFixed(2)) : null,
      totalFeedback: feedbackSummary._count._all,
    },
    promptDefinitions: listPromptDefinitions(),
    recentExecutions,
  };
}
