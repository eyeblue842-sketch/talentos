import { prisma } from '../../config/db.js';

export function findAccessibleCandidateForMatch(organisationId, candidateId) {
  return prisma.candidateProfile.findFirst({
    where: {
      id: candidateId,
      OR: [
        { organisationId },
        { applications: { some: { organisationId } } },
        { savedByRecruiters: { some: { organisationId } } },
      ],
    },
    include: {
      latestResumeAsset: true,
    },
  });
}

export function findAccessibleJobForMatch(organisationId, jobId) {
  return prisma.job.findFirst({
    where: {
      id: jobId,
      organisationId,
    },
    include: {
      requisition: true,
    },
  });
}

export function findCandidateIntelligenceStateForMatch(organisationId, candidateId, kind) {
  return prisma.candidateIntelligenceState.findUnique({
    where: {
      organisationId_candidateId_kind: {
        organisationId,
        candidateId,
        kind,
      },
    },
  });
}

export function findJobDescriptionStateForMatch(organisationId, jobId, kind) {
  return prisma.jobDescriptionState.findUnique({
    where: {
      organisationId_jobId_kind: {
        organisationId,
        jobId,
        kind,
      },
    },
  });
}

export function findLatestCandidateMatchResult(organisationId, entityType, entityId, resultVersion, promptVersion) {
  return prisma.intelligenceResult.findFirst({
    where: {
      organisationId,
      entityType,
      entityId,
      resultVersion,
      promptVersion,
      dismissedAt: null,
      supersededAt: null,
    },
    include: { execution: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function upsertCandidateJobMatchStateRecord(organisationId, candidateId, jobId, createData, updateData) {
  return prisma.candidateJobMatchState.upsert({
    where: {
      organisationId_candidateId_jobId: {
        organisationId,
        candidateId,
        jobId,
      },
    },
    create: createData,
    update: updateData,
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
}

export function findCandidateJobMatchStateWithRelations(organisationId, candidateId, jobId) {
  return prisma.candidateJobMatchState.findUnique({
    where: {
      organisationId_candidateId_jobId: {
        organisationId,
        candidateId,
        jobId,
      },
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
}

export function findCandidateJobMatchState(organisationId, candidateId, jobId) {
  return prisma.candidateJobMatchState.findUnique({
    where: {
      organisationId_candidateId_jobId: {
        organisationId,
        candidateId,
        jobId,
      },
    },
  });
}

export function findPendingCandidateMatchTask(entityType, entityId) {
  return prisma.backgroundTask.findFirst({
    where: {
      type: 'CANDIDATE_MATCH_GENERATION',
      entityType,
      entityId,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function findCandidateMatchTaskActor(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { recruiterProfile: true, candidateProfile: true },
  });
}
