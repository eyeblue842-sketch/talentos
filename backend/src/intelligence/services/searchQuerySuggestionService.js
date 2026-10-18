import { semanticSearchSuggestionResponseSchema } from '@careeriz/shared';
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
  // Keyword suggestions are derived from the public skill-expansion catalogue
  // (no candidate PII), so they are available to every recruiter rather than
  // gated behind a per-org feature flag. We still touch the feature row so the
  // toggle keeps existing for any future staged rollout.
  await ensureSuggestionFeature(context);

  const baseTerms = String(payload.query || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const expansion = expandSemanticSkills(baseTerms, {
    expansionEnabled: true,
    transferableSkillsEnabled: true,
  });


  const suggestions = uniqueSuggestions([
    ...baseTerms.map((term) => ({
      text: term,
      reason: 'Current query term',
      source: 'QUERY',
    })),
    ...expansion.expansions
      .filter((item) => item.expandedTerm && item.expandedTerm.trim().toLowerCase() !== String(item.normalizedTerm || '').trim().toLowerCase())
      .slice(0, 12)
      .map((item) => ({
        text: item.expandedTerm,
        reason: `${item.relationshipType.toLowerCase()} skill`,
        source: 'EXPANSION',
      })),
  ]).slice(0, Math.min(20, Number(payload.limit) || 12));

  return semanticSearchSuggestionResponseSchema.parse({
    suggestions,
  });
}
