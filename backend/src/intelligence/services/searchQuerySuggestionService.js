import { semanticSearchSuggestionResponseSchema } from '@careeriz/shared';
import { prisma } from '../../config/db.js';
import { requireEnterprisePermission } from '../../services/enterprisePermissionService.js';
import { expandSemanticSkills } from './semanticSkillExpansionService.js';
import {
  createOrganisationFeature,
  findOrganisationFeature,
} from '../repositories/featureAccessRepository.js';

function uniqueSuggestions(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = String(item.text || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function ensureSuggestionFeature(context) {
  const flag = await findOrganisationFeature(
    context.organisationId,
    'intelligence.search_suggestions',
  ).catch(() => null);

  if (!flag) {
    await createOrganisationFeature({
        organisationId: context.organisationId,
        key: 'intelligence.search_suggestions',
        description: 'Semantic search suggestions',
        enabled: false,
    }).catch(() => {});
  }

  return Boolean(flag?.enabled);
}

export async function getSemanticSearchSuggestions(actorUser, payload) {
  const context = await requireEnterprisePermission(actorUser, 'intelligence.search.read');
  const featureEnabled = await ensureSuggestionFeature(context);
  if (!featureEnabled) {
    return semanticSearchSuggestionResponseSchema.parse({ suggestions: [] });
  }

  const baseTerms = String(payload.query || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const expansion = expandSemanticSkills(baseTerms, {
    expansionEnabled: true,
    transferableSkillsEnabled: true,
  });

  const [recentQueries, savedSearches, sourceJob, sourceCandidate] = await Promise.all([
    prisma.semanticSearchQuery.findMany({
      where: {
        organisationId: context.organisationId,
        createdByUserId: actorUser.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }).catch(() => []),
    prisma.savedCandidateSearch.findMany({
      where: {
        organisationId: context.organisationId,
        OR: [
          { ownerUserId: actorUser.id },
          { isShared: true },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }).catch(() => []),
    payload.sourceJobId || payload.jobId
      ? prisma.job.findFirst({
          where: {
            id: payload.sourceJobId || payload.jobId,
            organisationId: context.organisationId,
          },
          select: { title: true, skillsRequired: true },
        }).catch(() => null)
      : Promise.resolve(null),
    payload.sourceCandidateId
      ? prisma.candidateProfile.findFirst({
          where: {
            id: payload.sourceCandidateId,
            OR: [
              { organisationId: context.organisationId },
              { applications: { some: { organisationId: context.organisationId } } },
              { savedByRecruiters: { some: { organisationId: context.organisationId } } },
            ],
          },
          select: { currentTitle: true, skills: true },
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const suggestions = uniqueSuggestions([
    ...baseTerms.map((term) => ({
      text: term,
      reason: 'Current query term',
      source: 'QUERY',
    })),
    ...expansion.expansions.slice(0, 8).map((item) => ({
      text: uniqueSuggestions([{ text: `${item.normalizedTerm} ${item.expandedTerm}` }])[0]?.text || `${item.normalizedTerm} ${item.expandedTerm}`,
      reason: `${item.relationshipType.toLowerCase()} skill expansion`,
      source: 'EXPANSION',
    })),
    ...recentQueries.map((item) => ({
      text: item.normalizedQuery || item.rawQuery || '',
      reason: 'Recent search',
      source: 'RECENT_SEARCH',
    })),
    ...savedSearches.map((item) => ({
      text: item.rawQuery || item.name,
      reason: 'Saved search',
      source: 'SAVED_SEARCH',
    })),
    ...(sourceJob?.skillsRequired || []).slice(0, 4).map((skill) => ({
      text: `${sourceJob.title} ${skill}`.trim(),
      reason: 'Job context suggestion',
      source: 'JOB_CONTEXT',
    })),
    ...(sourceCandidate?.skills || []).slice(0, 4).map((skill) => ({
      text: `${sourceCandidate.currentTitle || ''} ${skill}`.trim(),
      reason: 'Candidate context suggestion',
      source: 'CANDIDATE_CONTEXT',
    })),
  ]).slice(0, Math.min(20, Number(payload.limit) || 8));

  return semanticSearchSuggestionResponseSchema.parse({
    suggestions,
  });
}
