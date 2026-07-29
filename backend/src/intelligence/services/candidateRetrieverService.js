import { prisma } from '../../config/db.js';
import { searchCandidates } from '../../services/searchService.js';

const TRANSFERABLE_RELATIONSHIPS = new Set(['TRANSFERABLE']);

function uniqueStrings(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function mapIntentToSearchFilters(intent, plan) {
  const skillFilters = uniqueStrings([
    ...(intent.filters.skills || []),
    ...(intent.filters.requiredSkills || []),
    ...(intent.filters.optionalSkills || []),
  ]);
  const useRawKeyword = ['KEYWORD', 'BOOLEAN'].includes(plan.searchMode);
  const filters = {
    keyword: useRawKeyword && !skillFilters.length ? intent.keyword || undefined : undefined,
    designation: intent.role || undefined,
    location: intent.filters.location || undefined,
    skills: skillFilters.join(', ') || undefined,
    minExperience: intent.filters.minExperience ?? undefined,
    maxExperience: intent.filters.maxExperience ?? undefined,
    currentCompany: intent.filters.currentEmployer || undefined,
    previousCompany: intent.filters.previousEmployer || undefined,
    education: intent.filters.education || undefined,
    noticePeriod: intent.filters.noticePeriodDaysMax != null
      ? `${intent.filters.noticePeriodDaysMax} Days`
      : undefined,
    sortBy: plan.searchMode === 'KEYWORD' ? 'relevance' : 'experience',
    page: plan.pagination.page,
    pageSize: plan.pagination.pageSize,
  };

  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== ''));
}

function buildExpansionMaps(expansions = []) {
  const byExpandedTerm = new Map();
  const expandedTerms = [];
  const transferableTerms = [];

  for (const item of expansions) {
    const key = item.expandedTerm.toLowerCase();
    byExpandedTerm.set(key, item);
    expandedTerms.push(item.expandedTerm);
    if (TRANSFERABLE_RELATIONSHIPS.has(item.relationshipType)) {
      transferableTerms.push(item.expandedTerm);
    }
  }

  return {
    byExpandedTerm,
    expandedTerms: uniqueStrings(expandedTerms),
    transferableTerms: uniqueStrings(transferableTerms),
  };
}

function buildMatchedTerms(candidate, intent, expansions = []) {
  const matchedTerms = [];
  const candidateSkills = (candidate.skills || []).map((item) => String(item).toLowerCase());
  const candidateText = [
    candidate.fullName,
    candidate.headline,
    candidate.currentTitle,
    candidate.currentCompany,
    candidate.location,
  ].filter(Boolean).join(' ').toLowerCase();
  const { byExpandedTerm } = buildExpansionMaps(expansions);

  for (const skill of uniqueStrings([
    ...(intent.filters.skills || []),
    ...(intent.filters.requiredSkills || []),
    ...(intent.filters.optionalSkills || []),
  ])) {
    if (candidateSkills.some((candidateSkill) => candidateSkill.includes(skill.toLowerCase()))) {
      matchedTerms.push({ term: skill, type: 'SKILL' });
    }
  }

  for (const expansion of expansions) {
    if (candidateSkills.some((candidateSkill) => candidateSkill.includes(expansion.expandedTerm.toLowerCase()))) {
      matchedTerms.push({ term: expansion.expandedTerm, type: 'SKILL' });
    }
  }

  if (intent.role && String(candidate.headline || candidate.currentTitle || '').toLowerCase().includes(intent.role.toLowerCase())) {
    matchedTerms.push({ term: intent.role, type: 'ROLE' });
  }

  if (intent.filters.location && String(candidate.location || '').toLowerCase().includes(intent.filters.location.toLowerCase())) {
    matchedTerms.push({ term: intent.filters.location, type: 'LOCATION' });
  }

  for (const phrase of intent.filters.exactPhrases || []) {
    if (candidateText.includes(phrase.toLowerCase())) {
      matchedTerms.push({ term: phrase, type: 'PHRASE' });
    }
  }

  for (const term of intent.filters.includeTerms || []) {
    if (candidateText.includes(term.toLowerCase()) || candidateSkills.some((skill) => skill.includes(term.toLowerCase()))) {
      matchedTerms.push({ term, type: byExpandedTerm.has(term.toLowerCase()) ? 'SKILL' : 'KEYWORD' });
    }
  }

  if (intent.keyword) {
    const loweredKeyword = intent.keyword.toLowerCase();
    if (candidateText.includes(loweredKeyword)) {
      matchedTerms.push({ term: intent.keyword, type: 'KEYWORD' });
    }
  }

  return matchedTerms;
}

function buildSourceChannels(intent, matchedTerms, expansions = [], intelligenceMap, candidateId) {
  const channels = new Set();
  if (intent.role || intent.filters.location || intent.filters.minExperience != null || intent.filters.maxExperience != null) {
    channels.add('STRUCTURED_FILTER');
  }
  if (intent.keyword) {
    channels.add('KEYWORD');
  }
  if (matchedTerms.some((item) => item.type === 'SKILL')) {
    channels.add('NORMALIZED_SKILL');
  }
  if (expansions.some((item) => item.relationshipType === 'RELATED')) {
    channels.add('RELATED_SKILL');
  }
  if (expansions.some((item) => item.relationshipType === 'TRANSFERABLE')) {
    channels.add('TRANSFERABLE_SKILL');
  }
  if (intelligenceMap.get(candidateId)?.skills?.normalized?.length) {
    channels.add('CANDIDATE_INTELLIGENCE');
  }
  if (['SIMILAR_CANDIDATE', 'SIMILAR_JOB'].includes(intent.mode || '')) {
    channels.add('SIMILARITY_CONTEXT');
  }
  return [...channels];
}

function buildRetrievalReasons(candidate, intent, matchedTerms, expansions, intelligenceMap) {
  const reasons = [];
  const matchedSkills = matchedTerms.filter((entry) => entry.type === 'SKILL').map((entry) => entry.term);
  if (matchedSkills.length) {
    reasons.push(`Matched skills: ${uniqueStrings(matchedSkills).join(', ')}`);
  }
  if (intent.role && String(candidate.headline || '').toLowerCase().includes(intent.role.toLowerCase())) {
    reasons.push(`Role alignment with ${intent.role}`);
  }
  if (intent.filters.location && String(candidate.location || '').toLowerCase().includes(intent.filters.location.toLowerCase())) {
    reasons.push(`Location aligned to ${intent.filters.location}`);
  }
  if (expansions.some((item) => item.relationshipType === 'TRANSFERABLE')) {
    reasons.push('Transferable skill alignment contributed to retrieval.');
  }
  const intelligence = intelligenceMap.get(candidate.id);
  if (intelligence?.skills?.normalized?.length) {
    reasons.push(`Profile intelligence contributed ${intelligence.skills.normalized.length} normalized skills.`);
  }
  if (!reasons.length && candidate.matchScore != null) {
    reasons.push(`Retrieved from recruiter search with relevance ${candidate.matchScore}.`);
  }
  return reasons.slice(0, 6);
}

function filterExcludedCandidates(items, intent) {
  const excludes = uniqueStrings(intent.filters.excludeTerms || []).map((item) => item.toLowerCase());
  if (!excludes.length) return items;

  return items.filter((item) => {
    const haystack = [
      item.candidate.fullName,
      item.candidate.headline,
      item.candidate.currentCompany,
      item.candidate.location,
      ...(item.candidate.skills || []),
    ].filter(Boolean).join(' ').toLowerCase();
    return !excludes.some((exclude) => haystack.includes(exclude));
  });
}

async function loadCandidateIntelligenceMap(candidateIds = []) {
  if (!candidateIds.length) return new Map();

  const states = await prisma.candidateIntelligenceState.findMany({
    where: {
      candidateId: { in: candidateIds },
      kind: 'PROFILE_OVERVIEW',
      latestResultId: { not: null },
    },
    select: {
      candidateId: true,
      latestResult: {
        select: {
          normalizedOutput: true,
        },
      },
    },
  }).catch(() => []);

  return new Map(states.map((state) => [state.candidateId, state.latestResult?.normalizedOutput || null]));
}

async function loadAccessibleCandidateIds(candidateIds = [], organisationId) {
  if (!candidateIds.length) return new Set();

  const rows = await prisma.candidateProfile.findMany({
    where: {
      id: { in: candidateIds },
      OR: [
        { organisationId },
        { applications: { some: { organisationId } } },
        { savedByRecruiters: { some: { organisationId } } },
      ],
    },
    select: {
      id: true,
    },
  });

  return new Set(rows.map((row) => row.id));
}

export async function retrieveCandidatesForSemanticSearch({
  actorUser,
  organisationId,
  intent,
  plan,
  expansions = [],
}) {
  const filters = mapIntentToSearchFilters(intent, plan);
  const searchResult = await searchCandidates(filters, organisationId, actorUser);
  const candidateIds = searchResult.items.map((candidate) => candidate.id);
  const accessibleIds = await loadAccessibleCandidateIds(candidateIds, organisationId);
  const visibleItems = searchResult.items.filter((candidate) => accessibleIds.has(candidate.id));
  const intelligenceMap = await loadCandidateIntelligenceMap(candidateIds);
  const expansionMaps = buildExpansionMaps(expansions);

  const items = visibleItems.map((candidate) => {
    const matchedTerms = buildMatchedTerms(candidate, intent, expansions);
    const retrievalReasons = buildRetrievalReasons(candidate, intent, matchedTerms, expansions, intelligenceMap);
    const sourceChannels = buildSourceChannels(intent, matchedTerms, expansions, intelligenceMap, candidate.id);

    return {
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName || null,
        headline: candidate.headline || null,
        location: candidate.location || null,
        totalExperience: candidate.totalExperience ?? null,
        skills: candidate.skills || [],
        currentCompany: candidate.currentCompany || null,
        matchScore: candidate.matchScore ?? 0,
      },
      retrieval: {
        score: candidate.matchScore ?? 0,
        rank: null,
        reasons: retrievalReasons,
        matchedTerms,
        expandedTerms: expansionMaps.expandedTerms.slice(0, 20),
        transferableTerms: expansionMaps.transferableTerms.slice(0, 20),
        warnings: [],
        sourceChannels,
      },
      retrievalScore: candidate.matchScore ?? 0,
      retrievalReasons,
      matchedTerms,
      expandedTerms: expansionMaps.expandedTerms.slice(0, 20),
      transferableTerms: expansionMaps.transferableTerms.slice(0, 20),
      warnings: [],
    };
  });

  const filteredItems = filterExcludedCandidates(items, intent).map((item, index) => ({
    ...item,
    retrieval: {
      ...item.retrieval,
      rank: index + 1,
    },
  }));

  return {
    items: filteredItems,
    meta: {
      ...searchResult.meta,
      total: filteredItems.length,
      pageCount: Math.max(1, Math.ceil(filteredItems.length / (searchResult.meta.pageSize || 1))),
    },
  };
}
