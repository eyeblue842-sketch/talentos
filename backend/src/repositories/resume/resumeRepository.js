import { prisma } from '../../config/db.js';

export function findCandidateResumeReference(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      latestResumeAssetId: true,
    },
  });
}

export function findCandidateProfileById(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
  });
}

export function updateCandidateProfile(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
  });
}

export function upsertSavedCandidate({ organisationId, recruiterId, candidateId, tag }) {
  return prisma.savedCandidate.upsert({
    where: { recruiterId_candidateId: { recruiterId, candidateId } },
    update: {
      organisationId,
      tag,
    },
    create: {
      organisationId,
      recruiterId,
      candidateId,
      tag,
    },
    include: { candidate: true },
  });
}

export function findSavedCandidateByOrganisationRecruiterAndCandidate(organisationId, recruiterId, candidateId) {
  return prisma.savedCandidate.findFirst({
    where: {
      organisationId,
      recruiterId,
      candidateId,
    },
  });
}

export function deleteSavedCandidateById(savedCandidateId) {
  return prisma.savedCandidate.delete({
    where: { id: savedCandidateId },
  });
}

export function countSavedCandidates(where) {
  return prisma.savedCandidate.count({ where });
}

export function findSavedCandidates(where, { skip, take }) {
  return prisma.savedCandidate.findMany({
    where,
    include: { candidate: true, recruiter: { include: { user: true } } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function findCandidateResumeAccessForOrganisation(candidateId, organisationId) {
  return prisma.candidateProfile.findFirst({
    where: {
      id: candidateId,
      OR: [
        { applications: { some: { organisationId } } },
        { savedByRecruiters: { some: { organisationId } } },
      ],
    },
  });
}

export function findResumeAssetById(assetId) {
  return prisma.resumeAsset.findUnique({
    where: { id: assetId },
  });
}
