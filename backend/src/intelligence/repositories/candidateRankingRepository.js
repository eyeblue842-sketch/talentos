import { prisma } from '../../config/db.js';

export function findRankingJob(organisationId, jobId) {
  return prisma.job.findFirst({
    where: {
      id: jobId,
      organisationId,
    },
  });
}

export function findRankingPoolApplications(organisationId, jobId, take) {
  return prisma.application.findMany({
    where: {
      organisationId,
      jobId,
    },
    select: {
      id: true,
      candidateId: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { appliedAt: 'desc' }],
    take,
  });
}

export function findLatestRankingSnapshot(organisationId, jobId) {
  return prisma.candidateRankingSnapshot.findFirst({
    where: {
      organisationId,
      jobId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findLatestRankingOverrides(organisationId, jobId) {
  const hasModel = Boolean(prisma.recruiterMatchOverride?.findMany);
  if (!hasModel) {
    return [];
  }

  return prisma.recruiterMatchOverride.findMany({
    where: { organisationId, jobId },
    orderBy: { createdAt: 'desc' },
  });
}

export function createRankingEntry(data) {
  return prisma.candidateRankingEntry.create({ data });
}

export function createRankingSnapshot(data) {
  return prisma.candidateRankingSnapshot.create({ data });
}

export function findRankingEntriesWithCandidateFallback(snapshotId, organisationId, orderBy) {
  return prisma.candidateRankingEntry.findMany({
    where: {
      snapshotId,
      organisationId,
    },
    orderBy,
    include: {
      candidate: true,
    },
  });
}

export function countRankingEntries(where) {
  return prisma.candidateRankingEntry.count({ where });
}

export function findRankingEntries(where, orderBy, skip, take) {
  return prisma.candidateRankingEntry.findMany({
    where,
    orderBy,
    skip,
    take,
  });
}

export function findRankingTaskActorUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { recruiterProfile: true, candidateProfile: true },
  });
}

export function findRankingSnapshotById(snapshotId) {
  return prisma.candidateRankingSnapshot.findUnique({
    where: { id: snapshotId },
  });
}

export function findCandidateJobMatchStateForRanking(organisationId, candidateId, jobId) {
  return prisma.candidateJobMatchState.findUnique({
    where: {
      organisationId_candidateId_jobId: {
        organisationId,
        candidateId,
        jobId,
      },
    },
    include: {
      latestResult: true,
    },
  });
}

export async function deleteRankingEntriesForSnapshot(snapshotId) {
  const hasDeleteMany = Boolean(prisma.candidateRankingEntry?.deleteMany);
  if (!hasDeleteMany) {
    return null;
  }

  return prisma.candidateRankingEntry.deleteMany({
    where: { snapshotId },
  });
}

export function updateRankingSnapshot(snapshotId, data) {
  return prisma.candidateRankingSnapshot.update({
    where: { id: snapshotId },
    data,
  });
}
