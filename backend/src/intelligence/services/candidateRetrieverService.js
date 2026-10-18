import { prisma } from '../../config/db.js';
import { searchCandidates } from '../../services/searchService.js';
import { searchResumesV2 } from '../../services/resumeSearchV2/service.js';
import { findCandidateSearchRowsByIds } from '../../repositories/search/candidateSearchRepository.js';
import { buildCandidateCard } from '../../services/search/candidateSearchCardService.js';

const TRANSFERABLE_RELATIONSHIPS = new Set(['TRANSFERABLE']);

// The semantic-search response schema caps free-text fields (e.g. summary <= 1000,
// most strings <= 240). AI-parsed candidate data can exceed these, which would make
// semanticSearchResponseSchema.parse() throw and surface as an empty result to the UI.
// Clamp defensively so real candidates always render.
function clampText(value, maxLength) {
  if (value === null || value === undefined) return value ?? null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function toYearOrNull(value) {
  const year = Number.parseInt(value ?? '', 10);
  return Number.isFinite(year) ? year : null;
}

function sanitizeEducationDetail(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const degree = clampText(detail.degree, 160);
  const institution = clampText(detail.institution, 240);
  const completionYear = toYearOrNull(detail.completionYear ?? detail.endYear);
  if (!degree && !institution && completionYear === null) return null;
  return { degree, institution, completionYear };
}

function clampStringArray(values, maxLength, maxItems) {
  if (!Array.isArray(values)) return [];
  const out = [];
  for (const value of values) {
    const text = clampText(value, maxLength);
    if (text) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function mapIntentToSearchFilters(intent, plan) {
  const skillFilters = uniqueStrings([
    ...(intent.filters.skills || []),
    ...(intent.filters.requiredSkills || []),
    ...(intent.filters.optionalSkills || []),
  ]);
  // When the query resolves to no structured signal (no skills/role/employer/location),
  // it is effectively a free-text/name lookup. Fall back to keyword matching so the DB
  // path narrows to matching candidates instead of returning the whole org databank.
  const hasStructuredIntent = Boolean(
    skillFilters.length
    || intent.filters.designation
    || intent.role
    || intent.filters.currentEmployer
    || intent.filters.previousEmployer
    || intent.filters.location
    || (Array.isArray(intent.filters.locations) && intent.filters.locations.length)
    || intent.filters.education
    || intent.filters.minExperience != null
    || intent.filters.maxExperience != null,
  );
  const useRawKeyword = ['KEYWORD', 'BOOLEAN'].includes(plan.searchMode) || !hasStructuredIntent;
  void useRawKeyword;
  const filters = {
    // Always carry the free-text query into the DB-fallback keyword match (name /
    // title / headline / summary). The keyword box now also populates `query`, so
    // a single-box search (including a candidate name) still resolves when the
    // OpenSearch skill retrieval returns nothing.
    keyword: intent.keyword || undefined,
    location: intent.filters.location || undefined,
    locations: intent.filters.locations || undefined,
    preferredLocations: intent.filters.preferredLocations || undefined,
    includeWillingToRelocate: intent.filters.includeWillingToRelocate || undefined,
    workAuthorization: intent.filters.workAuthorization || undefined,
    workPermitCountries: intent.filters.workPermitCountries || undefined,
    jobTypes: intent.filters.jobTypes || undefined,
    employmentTypes: intent.filters.employmentTypes || undefined,
    displayCandidateType: intent.filters.displayCandidateType || undefined,
    activeWithin: intent.filters.activeWithin ?? undefined,
    minExperience: intent.filters.minExperience ?? undefined,
    maxExperience: intent.filters.maxExperience ?? undefined,
    salaryMin: intent.filters.salaryMin ?? undefined,
    salaryMax: intent.filters.salaryMax ?? undefined,
    currentCompany: intent.filters.currentEmployer || undefined,
    previousCompany: intent.filters.previousEmployer || undefined,
    companyScope: intent.filters.companyScope || undefined,
    designation: intent.filters.designation || undefined,
    designationScope: intent.filters.designationScope || undefined,
    education: intent.filters.education || undefined,
    educationFilters: intent.filters.educationFilters || undefined,
    noticePeriod: intent.filters.noticePeriodDaysMax != null
      ? `${intent.filters.noticePeriodDaysMax} Days`
      : undefined,
    resumeAttachment: intent.filters.resumeAttachment || undefined,
    emailVerified: intent.filters.emailVerified || undefined,
    profileRecency: intent.filters.profileRecency || undefined,
    profileRecencyDays: intent.filters.profileRecencyDays || undefined,
    sortBy: intent.filters.sortBy || (plan.searchMode === 'KEYWORD' ? 'relevance' : 'experience'),
    page: plan.pagination.page,
    pageSize: plan.pagination.pageSize,
  };

  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null && value !== ''));
}

// --- OpenSearch-backed retrieval (keeps the existing Naukri-style UI/response
// shape; only the engine behind the semantic API changes) ---------------------

function tokenizeKeyword(raw) {
  return uniqueStrings(String(raw || '').split(/[\s,]+/)).slice(0, 12);
}

// Translate the semantic search intent into a resume-search-v2 (OpenSearch)
// request. Keywords/skills/role drive full-resume-text relevance ranking;
// structured fields become OpenSearch filters. Salary is intentionally left to
// the caller's existing downstream handling (avoids the salary-permission gate).
function mapIntentToV2Payload(intent, plan) {
  const skills = uniqueStrings([
    ...(intent.filters.skills || []),
    ...(intent.filters.requiredSkills || []),
    ...(intent.filters.optionalSkills || []),
  ]).slice(0, 25);
  const role = intent.filters.designation || intent.role || null;
  const keywordTerms = uniqueStrings([
    ...skills,
    ...(role ? [role] : []),
    ...tokenizeKeyword(intent.keyword),
  ]).slice(0, 25);
  const keywords = keywordTerms.map((term) => ({ term: String(term).slice(0, 120), mode: 'SHOULD' }));

  const locations = uniqueStrings([
    ...(intent.filters.location ? [intent.filters.location] : []),
    ...(Array.isArray(intent.filters.locations) ? intent.filters.locations : []),
  ]).slice(0, 20).map((value) => String(value).slice(0, 120));

  // IMPORTANT: skills / role / employer are matched as ranking keywords above,
  // NOT as hard filters. A free-text query like "engineer" is parsed into a
  // designation; turning that into a hard currentTitle filter (an AND match
  // against the exact title field) over-constrains and returns nothing. Only
  // genuine structured constraints a recruiter sets (location, experience
  // range) become hard filters.
  const filters = {};
  if (locations.length) filters.currentLocation = locations;
  if (intent.filters.minExperience != null) filters.minExperienceMonths = Math.max(0, Math.round(Number(intent.filters.minExperience) * 12));
  if (intent.filters.maxExperience != null) filters.maxExperienceMonths = Math.max(0, Math.round(Number(intent.filters.maxExperience) * 12));

  return {
    keywords,
    phrases: [],
    filters,
    sort: 'RELEVANCE',
    pageSize: Math.min(50, Math.max(Number(plan?.pagination?.pageSize) || 25, 25)),
    includeHighlights: false,
    includeExplain: false,
  };
}

// Returns the same `{ items, meta }` shape searchCandidates returns, with items
// as fully-hydrated candidate cards in OpenSearch relevance order. Returns null
// to signal the caller should fall back to the database engine.
async function retrieveViaOpenSearch({ actorUser, organisationId, intent, plan }) {
  if (!actorUser) return null;
  // Mirror the meta shape searchCandidates returns so the downstream response
  // schema (requires page/pageSize/warning) always validates.
  const page = Math.max(1, Number(plan?.pagination?.page) || 1);
  const pageSize = Math.max(1, Number(plan?.pagination?.pageSize) || 25);
  const buildMeta = (total) => ({ total, page, pageSize, searchMode: 'opensearch', warning: null });

  const payload = mapIntentToV2Payload(intent, plan);
  const result = await searchResumesV2(actorUser, payload, {});
  const orderedIds = uniqueStrings((result.items || []).map((item) => item.candidateId));
  if (!orderedIds.length) {
    return { items: [], meta: buildMeta(result.meta?.totalValue || 0) };
  }
  // Hydrate full cards (no extra keyword narrowing: OpenSearch already matched),
  // then reorder to preserve OpenSearch relevance ranking.
  const rows = await findCandidateSearchRowsByIds(orderedIds, {}, organisationId);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items = orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => buildCandidateCard(row, organisationId));
  return { items, meta: buildMeta(result.meta?.totalValue || items.length) };
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
        // Common recruiter databank: any resume made searchable and visible to
        // recruiters is part of the shared pool that EVERY organisation can
        // search, regardless of which organisation uploaded/imported it. This
        // is what makes a resume one org imports discoverable by all orgs.
        { searchableProfile: true, resumeVisibleToRecruiters: true },
        // Plus each org's own candidates even if not flagged searchable
        // (their own imports, their applicants, and candidates they saved).
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
  // Prefer the OpenSearch engine (accurate full-resume-text ranking across the
  // common databank). Fall back to the database engine if OpenSearch is
  // unavailable so search never hard-fails.
  let searchResult = null;
  try {
    searchResult = await retrieveViaOpenSearch({ actorUser, organisationId, intent, plan });
  } catch {
    searchResult = null;
  }
  // Fall back to the database engine when OpenSearch is unavailable (null) OR
  // returns no matches. The OpenSearch index matches resume CONTENT (skills,
  // titles, employment history) but not candidate names, so a name lookup
  // (e.g. "Vinoj Pillai") yields nothing there - the database keyword search
  // matches fullName and recovers it. Genuine no-match queries return empty
  // from both, so this never fabricates results.
  if (!searchResult || searchResult.items.length === 0) {
    searchResult = await searchCandidates(filters, organisationId, actorUser);
  }
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
        fullName: clampText(candidate.fullName, 240),
        headline: clampText(candidate.headline, 240),
        currentDesignation: clampText(candidate.currentDesignation, 240),
        location: clampText(candidate.location, 200),
        preferredLocations: clampStringArray(candidate.preferredLocations, 200, 30),
        preferredRoles: clampStringArray(candidate.preferredRoles, 200, 30),
        employmentPreferences: clampStringArray(candidate.employmentPreferences, 80, 20),
        workplacePreferences: clampStringArray(candidate.workplacePreferences, 80, 20),
        willingToRelocate: candidate.willingToRelocate,
        workAuthorization: candidate.workAuthorization || null,
        totalExperience: candidate.totalExperience ?? null,
        skills: clampStringArray(candidate.skills, 120, 80),
        currentCompany: clampText(candidate.currentCompany, 240),
        previousCompany: clampText(candidate.previousCompany, 240),
        previousDesignation: clampText(candidate.previousDesignation, 240),
        currentSalary: candidate.currentSalary ?? null,
        expectedSalary: candidate.expectedSalary ?? null,
        salaryVisible: candidate.salaryVisible !== false,
        noticePeriodDays: candidate.noticePeriodDays ?? null,
        availability: clampText(candidate.availability, 80),
        summary: clampText(candidate.summary, 1000),
        educationSummary: clampText(candidate.educationSummary, 300),
        educationDetail: sanitizeEducationDetail(candidate.educationDetail),
        profileImageUrl: candidate.profileImageUrl || null,
        resumeAvailable: Boolean(
          candidate.resumeAvailable
          || candidate.resumeUrl
          || candidate.latestResumeAssetId
          || candidate.latestResumeAsset,
        ),
        updatedAt: candidate.updatedAt || null,
        lastActiveAt: candidate.lastActiveAt || null,
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
