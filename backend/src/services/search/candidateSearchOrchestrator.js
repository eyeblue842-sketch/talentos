import { elastic, isElasticsearchEnabled } from '../../config/elastic.js';
import { env } from '../../config/env.js';
import {
  serializeCandidatePrivateDetail,
  serializeResumeBuilder,
} from '../../serializers/index.js';
import {
  findApplicationsByOrganisationCandidateIds,
  findAuthorizedCandidateDetailRecord,
  findCandidateSearchRowsByIds,
  findRecruiterCandidatePreviewRecord,
  findSavedCandidatesByOrganisationCandidateIds,
  findSearchCandidatesByFilters,
  findSearchCandidatesByIds,
} from '../../repositories/search/candidateSearchRepository.js';
import { recordAuditLog } from '../auditLogService.js';
import { buildKeywordMatch } from '../matchService.js';
import { requireOrganisationRole } from '../organisationAccessService.js';
import {
  buildCandidateCard,
  buildResumeSummary,
  formatOwnOrganisationAtsStatus,
  getGenericGlobalHiringActivity,
  getOwnOrganisationApplication,
} from './candidateSearchCardService.js';
import { filterCandidateRows } from './candidateSearchFilterService.js';
import { computeRelevanceScore, sortCandidateRows } from './candidateSearchRankingService.js';
import {
  createRecruiterSavedSearch as delegateCreateRecruiterSavedSearch,
  deleteRecruiterSavedSearch as delegateDeleteRecruiterSavedSearch,
  listRecruiterRecentSearches as delegateListRecruiterRecentSearches,
  listRecruiterSavedSearches as delegateListRecruiterSavedSearches,
  recordRecentSearch,
} from './recruiterSearchHistoryService.js';
import {
  addCandidatesToTalentPool as delegateAddCandidatesToTalentPool,
  createTalentPool as delegateCreateTalentPool,
  listTalentPools as delegateListTalentPools,
} from '../talent-pool/talentPoolService.js';
import {
  extractExperienceEntries,
  iso,
  normalizeString,
  normalizeStringArray,
} from './searchUtils.js';

const recruiterReadableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const resumeSearchFallbackWarning = 'Resume Search is using the standard database fallback while the search index is unavailable.';

export async function __searchCandidatesWithAdapters(
  filters = {},
  { elasticClient = elastic, candidateProfileDelegate } = {},
) {
  if (elasticClient) {
    const must = [];
    const keyword = normalizeString(filters.keyword || filters.booleanQuery);
    const skill = normalizeStringArray(filters.skills || filters.skill)[0];
    const location = normalizeString(filters.location);

    if (keyword) {
      must.push({
        multi_match: {
          query: keyword,
          fields: ['fullName^2', 'headline', 'currentTitle', 'skills', 'summary'],
        },
      });
    }
    if (skill) {
      must.push({ term: { skills: skill } });
    }
    if (location) {
      must.push({ term: { location } });
    }

    const response = await elasticClient.search({
      index: env.elasticsearchIndex,
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: 500,
    });

    const candidateIds = response.hits.hits.map((item) => item._id);
    if (!candidateIds.length) return [];

    return findSearchCandidatesByIds(candidateIds, { candidateProfileDelegate });
  }

  return findSearchCandidatesByFilters(filters, { candidateProfileDelegate });
}

async function getCandidateSourceRows(filters = {}, adapters = {}) {
  const elasticClient = adapters.elasticClient ?? elastic;
  const candidateProfileDelegate = adapters.candidateProfileDelegate;

  if (!isElasticsearchEnabled() || !elasticClient) {
    const rows = await findSearchCandidatesByFilters(filters, { candidateProfileDelegate });

    return {
      rows,
      searchMode: 'database',
      warning: resumeSearchFallbackWarning,
    };
  }

  try {
    const rows = await __searchCandidatesWithAdapters(filters, { elasticClient, candidateProfileDelegate });
    return {
      rows,
      searchMode: 'elasticsearch',
      warning: null,
    };
  } catch {
    const rows = await findSearchCandidatesByFilters(filters, { candidateProfileDelegate });

    return {
      rows,
      searchMode: 'database',
      warning: resumeSearchFallbackWarning,
    };
  }
}

export async function indexCandidateResume(candidate) {
  if (!isElasticsearchEnabled()) return;

  await elastic.index({
    index: env.elasticsearchIndex,
    id: candidate.id,
    document: {
      fullName: candidate.fullName,
      headline: candidate.headline,
      currentTitle: candidate.currentTitle,
      location: candidate.location,
      skills: candidate.skills,
      totalExperience: candidate.totalExperience,
      availability: candidate.availability,
      summary: candidate.summary,
    },
  });
}

async function getCandidateRowsForSearch(filters = {}, organisationId) {
  const searchSource = await getCandidateSourceRows(filters);
  const candidateIds = searchSource.rows.map((candidate) => candidate.id);
  if (!candidateIds.length) {
    return {
      rows: [],
      searchMode: searchSource.searchMode,
      warning: searchSource.warning,
    };
  }

  const [rows, savedCandidates, ownApplications] = await Promise.all([
    findCandidateSearchRowsByIds(candidateIds, filters, organisationId),
    organisationId
      ? findSavedCandidatesByOrganisationCandidateIds(organisationId, candidateIds)
      : Promise.resolve([]),
    organisationId
      ? findApplicationsByOrganisationCandidateIds(organisationId, candidateIds)
      : Promise.resolve([]),
  ]);

  const rowsWithOrganisationContext = rows.map((candidate) => ({
    ...candidate,
    savedByRecruiters: candidate.savedByRecruiters?.length
      ? candidate.savedByRecruiters
      : savedCandidates.filter((item) => item.candidateId === candidate.id),
    applications: candidate.applications?.length
      ? candidate.applications
      : ownApplications.filter((item) => item.candidateId === candidate.id),
  }));

  const filtered = filterCandidateRows(rowsWithOrganisationContext, filters).map((candidate) => ({
    ...candidate,
    __relevanceScore: computeRelevanceScore(candidate, filters, buildKeywordMatch),
  }));

  return {
    rows: sortCandidateRows(filtered, filters),
    searchMode: searchSource.searchMode,
    warning: searchSource.warning,
  };
}

export async function searchCandidates(filters = {}, organisationId, actorUser = null) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const searchResult = await getCandidateRowsForSearch(filters, organisationId);
  const rows = searchResult.rows;

  if (organisationId && actorUser) {
    await recordRecentSearch(actorUser, organisationId, filters);
  }

  const total = rows.length;
  const items = rows
    .slice((page - 1) * pageSize, page * pageSize)
    .map((candidate) => buildCandidateCard(candidate, organisationId));

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      searchMode: searchResult.searchMode,
      warning: searchResult.warning,
    },
  };
}

export async function getAuthorizedCandidateDetail(candidateId, organisationId, requestMeta = {}) {
  const candidate = await findAuthorizedCandidateDetailRecord(candidateId, organisationId);

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  const hasAccess = candidate.applications.length > 0 || candidate.savedByRecruiters.length > 0;
  if (!hasAccess) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  await recordAuditLog({
    organisationId,
    action: 'candidate.detail.access',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: {
      accessReason: candidate.applications.length > 0 ? 'applied_to_organisation_job' : 'saved_by_organisation_recruiter',
    },
    ...requestMeta,
  });

  return {
    ...serializeCandidatePrivateDetail(candidate),
    resumeBuilder: candidate.resumeBuilder ? serializeResumeBuilder(candidate.resumeBuilder) : null,
    resumeDownloadUrl: candidate.resumeUrl || candidate.latestResumeAssetId ? `/api/resumes/candidate/${candidateId}/download` : null,
    accessReason: candidate.applications.length > 0 ? 'applied_to_organisation_job' : 'saved_by_organisation_recruiter',
    organisationApplications: candidate.applications,
    organisationTags: [...new Set(candidate.savedByRecruiters.map((item) => item.tag).filter(Boolean))],
  };
}

export async function getRecruiterCandidatePreview(actorUser, candidateId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, recruiterReadableRoles, organisationId);
  const candidate = await findRecruiterCandidatePreviewRecord(candidateId, context.organisationId);

  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  const ownApplication = getOwnOrganisationApplication(candidate, context.organisationId);
  const canRevealPrivateFields = Boolean(ownApplication || candidate.savedByRecruiters.length);
  const currentRole = extractExperienceEntries(candidate)[0];

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'candidate.preview.access',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: {
      salaryVisible: canRevealPrivateFields,
      contactVisible: canRevealPrivateFields,
    },
    ...requestMeta,
  });

  return {
    id: candidate.id,
    fullName: candidate.fullName,
    headline: candidate.headline,
    currentTitle: candidate.currentTitle,
    title: candidate.currentTitle || candidate.headline || 'Candidate',
    location: candidate.location,
    preferredLocations: candidate.preferredLocations || [],
    totalExperience: candidate.totalExperience,
    availability: candidate.availability,
    noticePeriodDays: candidate.noticePeriodDays,
    skills: candidate.skills || [],
    summary: candidate.summary,
    resumeSummary: buildResumeSummary(candidate),
    currentCompany: currentRole?.company || null,
    currentSalary: canRevealPrivateFields ? candidate.currentCtcLpa : null,
    expectedSalary: canRevealPrivateFields ? candidate.expectedCtcLpa : null,
    salaryVisible: canRevealPrivateFields,
    emailVisible: canRevealPrivateFields,
    contact: canRevealPrivateFields && (candidate.user?.email || candidate.email)
      ? { email: candidate.user?.email || candidate.email }
      : null,
    resumeDownloadUrl: canRevealPrivateFields && (candidate.resumeUrl || candidate.latestResumeAssetId)
      ? `/api/resumes/candidate/${candidate.id}/download`
      : null,
    resumeBuilder: candidate.resumeBuilder ? serializeResumeBuilder(candidate.resumeBuilder) : null,
    organisationApplications: ownApplication ? [ownApplication] : [],
    organisationNotes: ownApplication?.notes || [],
    organisationActivities: ownApplication?.activities || [],
    organisationTags: [...new Set(candidate.savedByRecruiters.map((item) => item.tag).filter(Boolean))],
    talentPools: candidate.talentPoolMemberships.map((item) => ({
      id: item.talentPool.id,
      name: item.talentPool.name,
    })),
    globalHiringActivity: getGenericGlobalHiringActivity(candidate, context.organisationId),
    ownOrganisationAtsStatus: formatOwnOrganisationAtsStatus(ownApplication),
    atsApplicationId: ownApplication?.id || null,
    matchScore: computeRelevanceScore(candidate, {}, buildKeywordMatch),
    resumeScore: candidate.resumeBuilder?.completedScore || null,
    updatedAt: iso(candidate.updatedAt),
    lastActiveAt: iso(candidate.lastActiveAt),
  };
}

export async function listRecruiterSavedSearches(actorUser, organisationId = null) {
  return delegateListRecruiterSavedSearches(actorUser, organisationId);
}

export async function listRecruiterRecentSearches(actorUser, organisationId = null) {
  return delegateListRecruiterRecentSearches(actorUser, organisationId);
}

export async function createRecruiterSavedSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  return delegateCreateRecruiterSavedSearch(actorUser, payload, organisationId, requestMeta);
}

export async function deleteRecruiterSavedSearch(actorUser, searchId, organisationId = null, requestMeta = {}) {
  return delegateDeleteRecruiterSavedSearch(actorUser, searchId, organisationId, requestMeta);
}

export async function listTalentPools(actorUser, organisationId = null) {
  return delegateListTalentPools(actorUser, organisationId);
}

export async function createTalentPool(actorUser, payload, organisationId = null, requestMeta = {}) {
  return delegateCreateTalentPool(actorUser, payload, organisationId, requestMeta);
}

export async function addCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId = null, requestMeta = {}) {
  return delegateAddCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId, requestMeta);
}
