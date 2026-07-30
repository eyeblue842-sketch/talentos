import { prisma } from '../../config/db.js';

export function findAccessibleCandidateForIntelligence(organisationId, candidateId) {
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
      importedFromItems: {
        where: { organisationId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
  });
}

export function findLatestCandidateIntelligenceResult(organisationId, entityType, candidateId, resultVersion, promptVersion) {
  return prisma.intelligenceResult.findFirst({
    where: {
      organisationId,
      entityType,
      entityId: candidateId,
      resultVersion,
      promptVersion,
      dismissedAt: null,
      supersededAt: null,
    },
    include: { execution: true },
    orderBy: { createdAt: 'desc' },
  });
}

export function upsertCandidateIntelligenceStateRecord(candidateId, organisationId, kind, createData, updateData) {
  return prisma.candidateIntelligenceState.upsert({
    where: {
      organisationId_candidateId_kind: {
        organisationId,
        candidateId,
        kind,
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

export function findCandidateIntelligenceStateWithRelations(organisationId, candidateId, kind) {
  return prisma.candidateIntelligenceState.findUnique({
    where: {
      organisationId_candidateId_kind: {
        organisationId,
        candidateId,
        kind,
      },
    },
    include: {
      latestExecution: true,
      latestResult: { include: { execution: true } },
    },
  });
}

export function findCandidateIntelligenceState(organisationId, candidateId, kind) {
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

export function findPendingCandidateIntelligenceTask(entityType, entityId) {
  return prisma.backgroundTask.findFirst({
    where: {
      type: 'CANDIDATE_INTELLIGENCE_GENERATION',
      entityType,
      entityId,
      status: { in: ['PENDING', 'RUNNING', 'RETRY_SCHEDULED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export function findCandidateIntelligenceTaskActor(requestedByUserId) {
  return prisma.user.findUnique({
    where: { id: requestedByUserId },
    include: { recruiterProfile: true, candidateProfile: true },
  });
}

export function markCandidateIntelligenceStateStale(candidateId, staleReason, lastSourceChangedAt) {
  return prisma.candidateIntelligenceState.updateMany({
    where: { candidateId },
    data: {
      status: 'STALE',
      staleReason,
      lastSourceChangedAt,
    },
  });
}
