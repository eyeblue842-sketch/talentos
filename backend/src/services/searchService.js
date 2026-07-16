import { elastic } from '../config/elastic.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { serializeCandidatePrivateDetail, serializeCandidateSearchCard, serializeResumeBuilder } from '../serializers/index.js';

function serializeSearchCandidate(candidate) {
  return serializeCandidateSearchCard(candidate);
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
    if (filters.location) {
      must.push({ term: { location: filters.location } });
    }

    const response = await elasticClient.search({
      index: env.elasticsearchIndex,
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: 50,
    });

    const candidateIds = response.hits.hits.map((item) => item._id);
    const candidates = await candidateProfileDelegate.findMany({
      where: { id: { in: candidateIds } },
      include: { resumeBuilder: true },
    });
    return candidates.map(serializeSearchCandidate);
  }

  const candidates = await candidateProfileDelegate.findMany({
    where: {
      OR: filters.keyword
        ? [
            { fullName: { contains: filters.keyword, mode: 'insensitive' } },
            { headline: { contains: filters.keyword, mode: 'insensitive' } },
            { skills: { has: filters.keyword } },
          ]
        : undefined,
      location: filters.location ? { contains: filters.location, mode: 'insensitive' } : undefined,
      totalExperience: typeof filters.minExperience === 'number' ? { gte: filters.minExperience } : undefined,
      availability: filters.availability || undefined,
    },
    include: { resumeBuilder: true },
    orderBy: { updatedAt: 'desc' },
  });

  return candidates.map(serializeSearchCandidate);
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

export async function searchCandidates(filters = {}) {
  return __searchCandidatesWithAdapters(filters);
}

export async function getAuthorizedCandidateDetail(candidateId, organisationId) {
  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      resumeBuilder: true,
      applications: {
        where: { organisationId },
        select: { id: true },
      },
      savedByRecruiters: {
        where: { organisationId },
        select: { id: true },
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

  return {
    ...serializeCandidatePrivateDetail(candidate),
    resumeBuilder: candidate.resumeBuilder ? serializeResumeBuilder(candidate.resumeBuilder) : null,
    accessReason: candidate.applications.length > 0 ? 'applied_to_organisation_job' : 'saved_by_organisation_recruiter',
  };
}
