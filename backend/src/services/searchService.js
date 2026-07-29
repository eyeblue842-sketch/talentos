import { elastic, isElasticsearchEnabled } from '../config/elastic.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import {
  serializeCandidatePrivateDetail,
  serializeCandidateSearchCard,
  serializeResumeBuilder,
} from '../serializers/index.js';
import { recordAuditLog } from './auditLogService.js';
import { buildKeywordMatch } from './matchService.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';

const recruiterReadableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
const resumeSearchFallbackWarning = 'Resume Search is using the standard database fallback while the search index is unavailable.';
const resumeSearchCandidateSelect = {
  id: true,
  fullName: true,
  headline: true,
  currentTitle: true,
  location: true,
  totalExperience: true,
  availability: true,
  skills: true,
  summary: true,
  currentCtcLpa: true,
  expectedCtcLpa: true,
  noticePeriodDays: true,
  preferredLocations: true,
  preferredIndustries: true,
  willingToRelocate: true,
  workAuthorization: true,
  lastActiveAt: true,
  updatedAt: true,
  resumeUrl: true,
  latestResumeAssetId: true,
  resumeBuilder: {
    select: {
      education: true,
      experience: true,
      completedScore: true,
    },
  },
};

function normalizeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function daysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
}

function buildDbWhere(filters = {}) {
  const keyword = normalizeString(filters.keyword || filters.booleanQuery);
  const or = [];
  if (keyword) {
    or.push(
      { fullName: { contains: keyword, mode: 'insensitive' } },
      { headline: { contains: keyword, mode: 'insensitive' } },
      { currentTitle: { contains: keyword, mode: 'insensitive' } },
      { summary: { contains: keyword, mode: 'insensitive' } },
    );
  }

  const designation = normalizeString(filters.designation);
  if (designation) {
    or.push(
      { currentTitle: { contains: designation, mode: 'insensitive' } },
      { headline: { contains: designation, mode: 'insensitive' } },
    );
  }

  const location = normalizeString(filters.location);
  const minExperience = normalizeNumber(filters.minExperience);
  const maxExperience = normalizeNumber(filters.maxExperience);
  const currentSalary = normalizeNumber(filters.currentSalary);
  const expectedSalary = normalizeNumber(filters.expectedSalary);
  const source = normalizeString(filters.source);
  const profileStatus = normalizeString(filters.profileStatus);

  return {
    OR: or.length ? or : undefined,
    source: source || undefined,
    profileStatus: profileStatus || undefined,
    location: location ? { contains: location, mode: 'insensitive' } : undefined,
    totalExperience: minExperience != null || maxExperience != null
      ? {
          gte: minExperience != null ? minExperience : undefined,
          lte: maxExperience != null ? maxExperience : undefined,
        }
      : undefined,
    availability: normalizeString(filters.availability) || undefined,
    willingToRelocate: normalizeString(filters.relocation).toLowerCase() === 'open'
      ? true
      : normalizeString(filters.relocation).toLowerCase() === 'not open'
        ? false
        : undefined,
    currentCtcLpa: currentSalary != null ? { gte: currentSalary } : undefined,
    expectedCtcLpa: expectedSalary != null ? { lte: expectedSalary } : undefined,
    workAuthorization: normalizeString(filters.workAuthorization)
      ? { contains: normalizeString(filters.workAuthorization), mode: 'insensitive' }
      : undefined,
    updatedAt: normalizeString(filters.resumeFreshness) === 'Last 7 days'
      ? { gte: daysAgo(7) }
      : normalizeString(filters.resumeFreshness) === 'Last 30 days'
        ? { gte: daysAgo(30) }
        : normalizeString(filters.resumeFreshness) === 'Last 90 days'
          ? { gte: daysAgo(90) }
          : undefined,
    lastActiveAt: normalizeString(filters.lastActive) === 'Today'
      ? { gte: daysAgo(1) }
      : normalizeString(filters.lastActive) === 'Last 7 days'
        ? { gte: daysAgo(7) }
        : normalizeString(filters.lastActive) === 'Last 30 days'
          ? { gte: daysAgo(30) }
          : undefined,
    importedAt: normalizeString(filters.importedSince)
      ? { gte: new Date(filters.importedSince) }
      : undefined,
  };
}

function extractEducationEntries(candidate) {
  return Array.isArray(candidate.resumeBuilder?.education) ? candidate.resumeBuilder.education : [];
}

function extractExperienceEntries(candidate) {
  return Array.isArray(candidate.resumeBuilder?.experience) ? candidate.resumeBuilder.experience : [];
}

function matchesLooseText(source, query) {
  if (!query) return true;
  return normalizeString(source).toLowerCase().includes(normalizeString(query).toLowerCase());
}

function matchesSkills(candidateSkills, requestedSkills) {
  if (!requestedSkills.length) return true;
  const haystack = (candidateSkills || []).map((item) => normalizeString(item).toLowerCase());
  return requestedSkills.every((skill) => haystack.some((candidateSkill) => candidateSkill.includes(skill.toLowerCase())));
}

function matchesEducation(candidate, educationQuery) {
  if (!educationQuery) return true;
  return extractEducationEntries(candidate).some((entry) => (
    matchesLooseText(entry.degree, educationQuery) || matchesLooseText(entry.school, educationQuery)
  ));
}

function matchesCompany(candidate, companyQuery, mode = 'current') {
  if (!companyQuery) return true;
  const entries = extractExperienceEntries(candidate);
  if (!entries.length) return false;

  if (mode === 'current') {
    return matchesLooseText(entries[0]?.company, companyQuery);
  }

  return entries.some((entry) => matchesLooseText(entry.company, companyQuery));
}

function matchesResumeAttachment(candidate, resumeAttachment) {
  if (!resumeAttachment) return true;
  const hasResume = Boolean(candidate.resumeUrl || candidate.latestResumeAssetId || candidate.resumeBuilder);
  return resumeAttachment === 'Available' ? hasResume : !hasResume;
}

function matchesNoticePeriod(candidate, noticePeriod) {
  if (!noticePeriod) return true;
  const days = candidate.noticePeriodDays;
  if (days == null) {
    return noticePeriod === 'Immediate' ? candidate.availability === 'IMMEDIATE' : true;
  }

  switch (noticePeriod) {
    case 'Immediate':
      return days === 0;
    case '15 Days':
      return days <= 15;
    case '30 Days':
      return days <= 30;
    case '60 Days':
      return days <= 60;
    case '90 Days':
      return days <= 90;
    default:
      return true;
  }
}

function getOwnOrganisationApplication(candidate, organisationId) {
  return (candidate.applications || []).find((application) => application.organisationId === organisationId) || null;
}

function getGenericGlobalHiringActivity(candidate, organisationId) {
  const otherApplications = (candidate.applications || []).filter((application) => application.organisationId !== organisationId);
  if (!otherApplications.length) {
    if (candidate.lastActiveAt && new Date(candidate.lastActiveAt) >= daysAgo(30)) {
      return 'Recently Active';
    }
    return 'Available';
  }

  if (otherApplications.some((application) => application.currentStage === 'SELECTED')) {
    return 'Recently Joined';
  }
  if (otherApplications.some((application) => application.currentStage === 'INTERVIEW_SCHEDULED')) {
    return 'Interview Activity';
  }
  if (otherApplications.some((application) => application.currentStage === 'SHORTLISTED')) {
    return 'Shortlisted Elsewhere';
  }
  if (otherApplications.some((application) => application.currentStage === 'APPLIED')) {
    return 'Shortlisted Elsewhere';
  }

  return 'Recently Active';
}

function formatOwnOrganisationAtsStatus(application) {
  if (!application) return 'Not in ATS';
  switch (application.currentStage) {
    case 'APPLIED':
      return 'Applied';
    case 'SHORTLISTED':
      return 'Shortlisted';
    case 'INTERVIEW_SCHEDULED':
      return 'Technical Interview';
    case 'SELECTED':
      return 'Joined';
    case 'REJECTED':
      return 'Rejected';
    case 'WITHDRAWN':
      return 'Withdrawn';
    default:
      return application.statusLabel || 'In ATS';
  }
}

function buildResumeSummary(candidate) {
  if (candidate.summary) return candidate.summary;
  const skills = (candidate.skills || []).slice(0, 4).join(', ');
  const title = candidate.currentTitle || candidate.headline || 'Candidate';
  const location = candidate.location || 'shared locations';
  return `${title} with ${candidate.totalExperience || 0} years of experience, based in ${location}, strongest around ${skills || 'core capabilities'}.`;
}

function buildRecentSearchLabel(filters) {
  const parts = [
    normalizeString(filters.keyword || filters.booleanQuery),
    normalizeString(filters.location),
    normalizeString(filters.skills),
  ].filter(Boolean);

  return parts.length ? parts.join(' | ').slice(0, 120) : 'Resume search';
}

function sanitizeSearchQuery(rawQuery = {}) {
  return Object.fromEntries(
    Object.entries(rawQuery)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
}

function computeRelevanceScore(candidate, filters = {}) {
  const requestedSkills = normalizeStringArray(filters.skills);
  const keyword = normalizeString(filters.keyword || filters.booleanQuery);
  const scoreFromSkills = requestedSkills.length
    ? buildKeywordMatch(requestedSkills, candidate.skills || [])
    : 60;
  const keywordBonus = keyword && (
    matchesLooseText(candidate.fullName, keyword)
    || matchesLooseText(candidate.headline, keyword)
    || matchesLooseText(candidate.currentTitle, keyword)
  ) ? 20 : 0;
  const locationBonus = normalizeString(filters.location) && matchesLooseText(candidate.location, filters.location) ? 10 : 0;
  return Math.max(0, Math.min(100, scoreFromSkills + keywordBonus + locationBonus));
}

function sortCandidateRows(rows, filters = {}) {
  const sortBy = normalizeString(filters.sortBy || 'relevance');
  if (sortBy === 'resumeFreshness') {
    return rows.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  }
  if (sortBy === 'experience') {
    return rows.sort((left, right) => (right.totalExperience || 0) - (left.totalExperience || 0));
  }
  return rows.sort((left, right) => (right.__relevanceScore || 0) - (left.__relevanceScore || 0));
}

function buildCandidateCard(candidate, organisationId) {
  const ownApplication = getOwnOrganisationApplication(candidate, organisationId);
  const organisationTags = [...new Set((candidate.savedByRecruiters || []).map((item) => item.tag).filter(Boolean))];
  const latestEducation = extractEducationEntries(candidate)[0];
  const currentRole = extractExperienceEntries(candidate)[0];
  const canRevealCompensation = Boolean(ownApplication || organisationTags.length);

  return {
    ...serializeCandidateSearchCard({
      ...candidate,
      educationSummary: latestEducation?.degree
        ? `${latestEducation.degree}${latestEducation.school ? `, ${latestEducation.school}` : ''}`
        : undefined,
      savedByOrganisation: organisationTags.length > 0,
      organisationTags,
    }),
    currentCompany: currentRole?.company || null,
    noticePeriodDays: candidate.noticePeriodDays,
    currentSalary: canRevealCompensation ? candidate.currentCtcLpa : null,
    expectedSalary: canRevealCompensation ? candidate.expectedCtcLpa : null,
    salaryVisible: canRevealCompensation,
    preferredLocations: candidate.preferredLocations || [],
    keySkills: (candidate.skills || []).slice(0, 8),
    resumeUpdatedAt: iso(candidate.updatedAt),
    lastActiveAt: iso(candidate.lastActiveAt),
    matchScore: candidate.__relevanceScore || 0,
    globalHiringActivity: getGenericGlobalHiringActivity(candidate, organisationId),
    ownOrganisationAtsStatus: formatOwnOrganisationAtsStatus(ownApplication),
    organisationApplicationId: ownApplication?.id || null,
    resumeScore: candidate.resumeBuilder?.completedScore || null,
  };
}

function filterCandidateRows(rows, filters = {}) {
  const skills = normalizeStringArray(filters.skills);
  const currentCompany = normalizeString(filters.currentCompany);
  const previousCompany = normalizeString(filters.previousCompany);
  const education = normalizeString(filters.education);
  const industry = normalizeString(filters.industry);
  const noticePeriod = normalizeString(filters.noticePeriod);
  const resumeAttachment = normalizeString(filters.resumeAttachment);

  return rows.filter((candidate) => {
    if (!matchesSkills(candidate.skills, skills)) return false;
    if (!matchesCompany(candidate, currentCompany, 'current')) return false;
    if (!matchesCompany(candidate, previousCompany, 'any')) return false;
    if (!matchesEducation(candidate, education)) return false;
    if (industry && !(candidate.preferredIndustries || []).some((item) => matchesLooseText(item, industry))) return false;
    if (!matchesNoticePeriod(candidate, noticePeriod)) return false;
    if (!matchesResumeAttachment(candidate, resumeAttachment)) return false;
    return true;
  });
}

export async function __searchCandidatesWithAdapters(
  filters = {},
  { elasticClient = elastic, candidateProfileDelegate = prisma.candidateProfile } = {},
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

    return candidateProfileDelegate.findMany({
      where: { id: { in: candidateIds } },
      select: resumeSearchCandidateSelect,
    });
  }

  return candidateProfileDelegate.findMany({
    where: buildDbWhere(filters),
    select: resumeSearchCandidateSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

async function getCandidateSourceRows(filters = {}, adapters = {}) {
  const elasticClient = adapters.elasticClient ?? elastic;
  const candidateProfileDelegate = adapters.candidateProfileDelegate ?? prisma.candidateProfile;

  if (!isElasticsearchEnabled() || !elasticClient) {
    const rows = await candidateProfileDelegate.findMany({
      where: buildDbWhere(filters),
      select: resumeSearchCandidateSelect,
      orderBy: { updatedAt: 'desc' },
    });

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
    const rows = await candidateProfileDelegate.findMany({
      where: buildDbWhere(filters),
      select: resumeSearchCandidateSelect,
      orderBy: { updatedAt: 'desc' },
    });

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
    prisma.candidateProfile.findMany({
      where: {
        id: { in: candidateIds },
        ...buildDbWhere(filters),
      },
      select: {
        ...resumeSearchCandidateSelect,
        applications: {
          select: {
            id: true,
            candidateId: true,
            organisationId: true,
            currentStage: true,
            statusLabel: true,
            updatedAt: true,
          },
        },
        savedByRecruiters: {
          where: { organisationId },
          select: { tag: true, createdAt: true },
        },
      },
    }),
    organisationId
      ? prisma.savedCandidate.findMany({
          where: {
            organisationId,
            candidateId: { in: candidateIds },
          },
          select: {
            candidateId: true,
            tag: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    organisationId
      ? prisma.application.findMany({
          where: {
            organisationId,
            candidateId: { in: candidateIds },
          },
          select: {
            id: true,
            candidateId: true,
            organisationId: true,
            currentStage: true,
            statusLabel: true,
            updatedAt: true,
          },
        })
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
    __relevanceScore: computeRelevanceScore(candidate, filters),
  }));

  return {
    rows: sortCandidateRows(filtered, filters),
    searchMode: searchSource.searchMode,
    warning: searchSource.warning,
  };
}

async function recordRecentSearch(actorUser, organisationId, filters = {}) {
  if (!actorUser?.recruiterProfile?.id || !organisationId) return;
  const query = sanitizeSearchQuery(filters);
  if (!Object.keys(query).length) return;

  await prisma.recruiterSavedSearch.create({
    data: {
      organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      label: buildRecentSearchLabel(filters),
      query,
      type: 'RECENT',
    },
  });
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
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      resumeBuilder: true,
      applications: {
        where: { organisationId },
        include: {
          job: { include: { requisition: true } },
          notes: {
            where: { organisationId },
            include: { author: true },
            orderBy: { createdAt: 'desc' },
          },
          activities: {
            where: { organisationId },
            include: { actorUser: true },
            orderBy: { createdAt: 'desc' },
          },
          interviewProcesses: {
            include: {
              createdBy: true,
              rounds: {
                include: {
                  panelMembers: { include: { user: true } },
                  feedbacks: { include: { interviewer: true } },
                },
              },
            },
          },
        },
      },
      savedByRecruiters: {
        where: { organisationId },
      },
    },
  });

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
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      resumeBuilder: true,
      applications: {
        include: {
          job: { include: { requisition: true } },
          notes: {
            where: { organisationId: context.organisationId },
            include: { author: true },
            orderBy: { createdAt: 'desc' },
          },
          activities: {
            where: { organisationId: context.organisationId },
            include: { actorUser: true },
            orderBy: { createdAt: 'desc' },
          },
          interviewProcesses: {
            include: {
              createdBy: true,
              rounds: {
                include: {
                  panelMembers: { include: { user: true } },
                  feedbacks: { include: { interviewer: true } },
                },
              },
            },
          },
        },
      },
      savedByRecruiters: {
        where: { organisationId: context.organisationId },
        select: { tag: true },
      },
      talentPoolMemberships: {
        where: { talentPool: { organisationId: context.organisationId } },
        include: { talentPool: true },
      },
    },
  });

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
    matchScore: computeRelevanceScore(candidate, {}),
    resumeScore: candidate.resumeBuilder?.completedScore || null,
    updatedAt: iso(candidate.updatedAt),
    lastActiveAt: iso(candidate.lastActiveAt),
  };
}

export async function listRecruiterSavedSearches(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await prisma.recruiterSavedSearch.findMany({
    where: {
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      type: 'SAVED',
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function listRecruiterRecentSearches(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await prisma.recruiterSavedSearch.findMany({
    where: {
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      type: 'RECENT',
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
  }));
}

export async function createRecruiterSavedSearch(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const row = await prisma.recruiterSavedSearch.create({
    data: {
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
      label: payload.label,
      query: sanitizeSearchQuery(payload.query),
      type: payload.type || 'SAVED',
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.saved-search.create',
    entityType: 'RecruiterSavedSearch',
    entityId: row.id,
    afterData: { label: row.label, type: row.type },
    ...requestMeta,
  });

  return {
    id: row.id,
    label: row.label,
    type: row.type,
    query: row.query,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function deleteRecruiterSavedSearch(actorUser, searchId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const row = await prisma.recruiterSavedSearch.findFirst({
    where: {
      id: searchId,
      organisationId: context.organisationId,
      recruiterId: actorUser.recruiterProfile.id,
    },
  });

  if (!row) {
    const error = new Error('Saved search not found.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.recruiterSavedSearch.delete({ where: { id: row.id } });
  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.saved-search.delete',
    entityType: 'RecruiterSavedSearch',
    entityId: row.id,
    beforeData: { label: row.label, type: row.type },
    ...requestMeta,
  });

  return { deleted: true };
}

export async function listTalentPools(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const rows = await prisma.talentPool.findMany({
    where: { organisationId: context.organisationId },
    include: {
      candidates: {
        include: {
          candidate: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    candidateCount: row.candidates.length,
    candidates: row.candidates.map((item) => ({
      id: item.candidate.id,
      fullName: item.candidate.fullName,
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
}

export async function createTalentPool(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const pool = await prisma.talentPool.create({
    data: {
      organisationId: context.organisationId,
      createdByRecruiterId: actorUser.recruiterProfile.id,
      name: payload.name,
      description: payload.description || null,
    },
  });

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.talent-pool.create',
    entityType: 'TalentPool',
    entityId: pool.id,
    afterData: { name: pool.name },
    ...requestMeta,
  });

  return {
    id: pool.id,
    name: pool.name,
    description: pool.description,
    createdAt: iso(pool.createdAt),
    updatedAt: iso(pool.updatedAt),
  };
}

export async function addCandidatesToTalentPool(actorUser, poolId, candidateIds, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const pool = await prisma.talentPool.findFirst({
    where: {
      id: poolId,
      organisationId: context.organisationId,
    },
  });

  if (!pool) {
    const error = new Error('Talent pool not found.');
    error.statusCode = 404;
    throw error;
  }

  const candidates = await prisma.candidateProfile.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, fullName: true },
  });

  const validIds = new Set(candidates.map((candidate) => candidate.id));
  const items = [];
  for (const candidateId of candidateIds) {
    if (!validIds.has(candidateId)) {
      items.push({ candidateId, success: false, error: 'Candidate not found.' });
      continue;
    }

    try {
      const membership = await prisma.talentPoolCandidate.upsert({
        where: { talentPoolId_candidateId: { talentPoolId: pool.id, candidateId } },
        update: {},
        create: {
          talentPoolId: pool.id,
          candidateId,
        },
      });
      items.push({ candidateId, success: true, id: membership.id });
    } catch (error) {
      items.push({ candidateId, success: false, error: error.message });
    }
  }

  await recordAuditLog({
    organisationId: context.organisationId,
    actorUserId: actorUser.id,
    action: 'resume-search.talent-pool.candidates.add',
    entityType: 'TalentPool',
    entityId: pool.id,
    metadata: {
      addedCount: items.filter((item) => item.success).length,
      candidateIds,
    },
    ...requestMeta,
  });

  return {
    pool: {
      id: pool.id,
      name: pool.name,
    },
    items,
  };
}
