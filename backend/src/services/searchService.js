import { elastic } from '../config/elastic.js';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';

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
  if (elastic) {
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

    const response = await elastic.search({
      index: env.elasticsearchIndex,
      query: must.length ? { bool: { must } } : { match_all: {} },
      size: 50,
    });

    const candidateIds = response.hits.hits.map((item) => item._id);
    return prisma.candidateProfile.findMany({
      where: { id: { in: candidateIds } },
      include: { user: true, resumeBuilder: true },
    });
  }

  return prisma.candidateProfile.findMany({
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
    include: { user: true, resumeBuilder: true },
    orderBy: { updatedAt: 'desc' },
  });
}
