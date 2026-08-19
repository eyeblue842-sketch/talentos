import { prisma } from '../../config/db.js';
import { buildDbWhere } from '../../services/search/searchUtils.js';

const resumeSearchCandidateSelect = {
  id: true,
  fullName: true,
  headline: true,
  profileImageUrl: true,
  currentTitle: true,
  currentEmployer: true,
  currentDesignation: true,
  location: true,
  preferredLocations: true,
  preferredRoles: true,
  employmentPreferences: true,
  workplacePreferences: true,
  totalExperience: true,
  availability: true,
  skills: true,
  summary: true,
  currentCtcLpa: true,
  expectedCtcLpa: true,
  noticePeriodDays: true,
  preferredIndustries: true,
  willingToRelocate: true,
  workAuthorization: true,
  lastActiveAt: true,
  updatedAt: true,
  createdAt: true,
  resumeUrl: true,
  latestResumeAssetId: true,
  educationEntries: true,
  experienceEntries: true,
  user: { select: { emailVerifiedAt: true } },
  latestResumeAsset: { select: { id: true, status: true, kind: true, updatedAt: true } },
  resumeBuilder: {
    select: {
      education: true,
      experience: true,
      completedScore: true,
    },
  },
};

export function findSearchCandidatesByIds(
  candidateIds,
  { candidateProfileDelegate = prisma.candidateProfile } = {},
) {
  return candidateProfileDelegate.findMany({
    where: { id: { in: candidateIds } },
    select: resumeSearchCandidateSelect,
  });
}

export function findSearchCandidatesByFilters(
  filters = {},
  { candidateProfileDelegate = prisma.candidateProfile } = {},
) {
  return candidateProfileDelegate.findMany({
    where: buildDbWhere(filters),
    select: resumeSearchCandidateSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

export function findCandidateSearchRowsByIds(candidateIds, filters = {}, organisationId) {
  return prisma.candidateProfile.findMany({
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
  });
}

export function findSavedCandidatesByOrganisationCandidateIds(organisationId, candidateIds) {
  return prisma.savedCandidate.findMany({
    where: {
      organisationId,
      candidateId: { in: candidateIds },
    },
    select: {
      candidateId: true,
      tag: true,
      createdAt: true,
    },
  });
}

export function findApplicationsByOrganisationCandidateIds(organisationId, candidateIds) {
  return prisma.application.findMany({
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
  });
}

export function createRecruiterRecentSearch(organisationId, recruiterId, label, query) {
  return prisma.recruiterSavedSearch.create({
    data: {
      organisationId,
      recruiterId,
      label,
      query,
      type: 'RECENT',
    },
  });
}

export function findAuthorizedCandidateDetailRecord(candidateId, organisationId) {
  return prisma.candidateProfile.findUnique({
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
}

export function findRecruiterCandidatePreviewRecord(candidateId, organisationId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      user: true,
      resumeBuilder: true,
      applications: {
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
        select: { tag: true },
      },
      talentPoolMemberships: {
        where: { talentPool: { organisationId } },
        include: { talentPool: true },
      },
    },
  });
}

export function findRecruiterSavedSearches(organisationId, recruiterId) {
  return prisma.recruiterSavedSearch.findMany({
    where: {
      organisationId,
      recruiterId,
      type: 'SAVED',
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
}

export function findRecruiterRecentSearches(organisationId, recruiterId) {
  return prisma.recruiterSavedSearch.findMany({
    where: {
      organisationId,
      recruiterId,
      type: 'RECENT',
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
}

export function createRecruiterSavedSearch(organisationId, recruiterId, label, query, type = 'SAVED') {
  return prisma.recruiterSavedSearch.create({
    data: {
      organisationId,
      recruiterId,
      label,
      query,
      type,
    },
  });
}

export function findRecruiterSavedSearchById(searchId, organisationId, recruiterId) {
  return prisma.recruiterSavedSearch.findFirst({
    where: {
      id: searchId,
      organisationId,
      recruiterId,
    },
  });
}

export function deleteRecruiterSavedSearchById(searchId) {
  return prisma.recruiterSavedSearch.delete({ where: { id: searchId } });
}

export function findTalentPoolsByOrganisation(organisationId) {
  return prisma.talentPool.findMany({
    where: { organisationId },
    include: {
      candidates: {
        include: {
          candidate: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export function createTalentPoolRecord(organisationId, recruiterId, name, description) {
  return prisma.talentPool.create({
    data: {
      organisationId,
      createdByRecruiterId: recruiterId,
      name,
      description: description || null,
    },
  });
}

export function findTalentPoolById(poolId, organisationId) {
  return prisma.talentPool.findFirst({
    where: {
      id: poolId,
      organisationId,
    },
  });
}

export function findCandidateIdsAndNames(candidateIds) {
  return prisma.candidateProfile.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, fullName: true },
  });
}

export function upsertTalentPoolCandidate(talentPoolId, candidateId) {
  return prisma.talentPoolCandidate.upsert({
    where: { talentPoolId_candidateId: { talentPoolId, candidateId } },
    update: {},
    create: {
      talentPoolId,
      candidateId,
    },
  });
}
