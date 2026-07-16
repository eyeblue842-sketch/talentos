import { elastic } from '../config/elastic.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { serializeCandidatePrivateDetail, serializeCandidateSearchCard, serializeResumeBuilder } from '../serializers/index.js';
import { recordAuditLog } from './auditLogService.js';

function buildDbWhere(filters = {}) {
  const or = [];
  if (filters.keyword) {
    or.push(
      { fullName: { contains: filters.keyword, mode: 'insensitive' } },
      { headline: { contains: filters.keyword, mode: 'insensitive' } },
      { skills: { has: filters.keyword } },
    );
  }
  if (filters.skill) {
    or.push({ skills: { has: filters.skill } });
  }

  return {
    OR: or.length ? or : undefined,
    location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
    totalExperience: typeof filters.minExperience === 'number' || typeof filters.maxExperience === 'number'
      ? {
          gte: typeof filters.minExperience === 'number' ? filters.minExperience : undefined,
          lte: typeof filters.maxExperience === 'number' ? filters.maxExperience : undefined,
        }
      : undefined,
    availability: filters.availability || undefined,
  };
}

function buildCandidateCard(candidate, organisationSavedCandidates = []) {
  const matchingSaved = organisationSavedCandidates.filter((item) => item.candidateId === candidate.id);
  const educationEntries = Array.isArray(candidate.resumeBuilder?.education)
    ? candidate.resumeBuilder.education
    : [];
  const latestEducation = educationEntries[0];

  return serializeCandidateSearchCard({
    ...candidate,
    educationSummary: latestEducation?.degree
      ? `${latestEducation.degree}${latestEducation.school ? `, ${latestEducation.school}` : ''}`
      : undefined,
    savedByOrganisation: matchingSaved.length > 0,
    organisationTags: [...new Set(matchingSaved.map((item) => item.tag).filter(Boolean))],
  });
}

export async function __searchCandidatesWithAdapters(
  filters = {},
  { elasticClient = elastic, candidateProfileDelegate = prisma.candidateProfile } = {}
) {
  if (elasticClient) {
    const must = [];
    if (filters.keyword) {
      must.push({
        multi_match: {
          query: filters.keyword,
          fields: ['fullName^2', 'headline', 'skills'],
        },
      });
    }
    if (filters.skill) {
      must.push({ term: { skills: filters.skill } });
    }
    if (filters.location) {
      must.push({ term: { location: filters.location } });
    }

    const response = await elasticClient.search({
      index: env.elasticsearchIndex,
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: 200,
    });

    const candidateIds = response.hits.hits.map((item) => item._id);
    const candidates = await candidateProfileDelegate.findMany({
      where: { id: { in: candidateIds } },
      include: { resumeBuilder: true },
    });
    return candidates;
  }

  return candidateProfileDelegate.findMany({
    where: buildDbWhere(filters),
    include: { resumeBuilder: true },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function indexCandidateResume(candidate) {
  if (!elastic) return;

  await elastic.index({
    index: env.elasticsearchIndex,
    id: candidate.id,
    document: {
      fullName: candidate.fullName,
      headline: candidate.headline,
      location: candidate.location,
      skills: candidate.skills,
      totalExperience: candidate.totalExperience,
      availability: candidate.availability,
    },
  });
}

export async function searchCandidates(filters = {}, organisationId) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const sourceRows = await __searchCandidatesWithAdapters(filters);
  let filteredRows = sourceRows;

  if (filters.fresher === 'true') {
    filteredRows = filteredRows.filter((candidate) => candidate.totalExperience === 0);
  } else if (filters.fresher === 'false') {
    filteredRows = filteredRows.filter((candidate) => candidate.totalExperience > 0);
  }

  if (filters.tag && organisationId) {
    const taggedIds = new Set((await prisma.savedCandidate.findMany({
      where: { organisationId, tag: filters.tag },
      select: { candidateId: true },
    })).map((item) => item.candidateId));
    filteredRows = filteredRows.filter((candidate) => taggedIds.has(candidate.id));
  }

  const savedCandidates = organisationId
    ? await prisma.savedCandidate.findMany({
        where: { organisationId, candidateId: { in: filteredRows.map((candidate) => candidate.id) } },
      })
    : [];

  const total = filteredRows.length;
  const items = filteredRows
    .slice((page - 1) * pageSize, page * pageSize)
    .map((candidate) => buildCandidateCard(candidate, savedCandidates));

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
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
    accessReason: candidate.applications.length > 0 ? 'applied_to_organisation_job' : 'saved_by_organisation_recruiter',
    organisationApplications: candidate.applications,
    organisationTags: [...new Set(candidate.savedByRecruiters.map((item) => item.tag).filter(Boolean))],
  };
}
