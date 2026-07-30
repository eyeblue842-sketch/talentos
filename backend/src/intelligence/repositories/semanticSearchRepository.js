import { prisma } from '../../config/db.js';

export function findAccessibleSemanticSearchCandidate(organisationId, candidateId) {
  return prisma.candidateProfile.findFirst({
    where: {
      id: candidateId,
      OR: [
        { organisationId },
        { applications: { some: { organisationId } } },
        { savedByRecruiters: { some: { organisationId } } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      headline: true,
      currentTitle: true,
      currentEmployer: true,
      location: true,
      totalExperience: true,
      skills: true,
      frameworks: true,
      tools: true,
      cloudPlatforms: true,
      databases: true,
      linkedInUrlNormalized: true,
    },
  });
}

export function findAccessibleSemanticSearchJob(organisationId, jobId) {
  return prisma.job.findFirst({
    where: {
      id: jobId,
      organisationId,
    },
    select: {
      id: true,
      title: true,
      location: true,
      workplaceType: true,
      employmentType: true,
      experienceMin: true,
      experienceMax: true,
      skillsRequired: true,
      requirements: true,
      responsibilities: true,
    },
  });
}

export function findLatestSemanticSearchQuery(organisationId, createdByUserId) {
  return prisma.semanticSearchQuery.findFirst({
    where: {
      organisationId,
      createdByUserId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function createSemanticSearchQuery(data) {
  return prisma.semanticSearchQuery.create({ data });
}

export function createSemanticSearchExecution(data) {
  return prisma.semanticSearchExecution.create({ data });
}

export function updateSemanticSearchExecution(executionId, data) {
  return prisma.semanticSearchExecution.update({
    where: { id: executionId },
    data,
  });
}

export function countSemanticSearchHistory(organisationId, createdByUserId) {
  return prisma.semanticSearchQuery.count({
    where: {
      organisationId,
      createdByUserId,
    },
  });
}

export function findSemanticSearchHistory(organisationId, createdByUserId, skip, take) {
  return prisma.semanticSearchQuery.findMany({
    where: {
      organisationId,
      createdByUserId,
    },
    include: {
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function findSemanticSearchHistoryDetail(organisationId, createdByUserId, queryId) {
  return prisma.semanticSearchQuery.findFirst({
    where: {
      id: queryId,
      organisationId,
      createdByUserId,
    },
    include: {
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}
