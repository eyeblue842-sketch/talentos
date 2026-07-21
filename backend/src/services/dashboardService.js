import { prisma } from '../config/db.js';
import { serializeApplication, serializeJob } from '../serializers/index.js';
import { requireOrganisationContext } from './organisationAccessService.js';

function missingRelationTable(error) {
  return error?.code === 'P2021' || error?.message?.includes('does not exist in the current database');
}

async function countOrZero(query) {
  try {
    return await query();
  } catch (error) {
    if (missingRelationTable(error)) {
      return 0;
    }
    throw error;
  }
}

export async function getRecruiterDashboard(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const closingSoonDate = new Date();
  closingSoonDate.setDate(closingSoonDate.getDate() + 14);

  const [jobsCount, activeJobsCount, applicantsCount, recentApplications, pipelineCounts, upcomingInterviews, openRequisitions, savedCandidatesCount, jobsClosingSoon, pendingInvitationsCount, offersDraftCount, offersPendingApprovalCount, offersReleasedCount, offersAcceptedCount, upcomingJoinersCount] = await Promise.all([
    prisma.job.count({ where: { organisationId: context.organisationId } }),
    prisma.job.count({ where: { organisationId: context.organisationId, status: { in: ['OPEN', 'ON_HOLD'] } } }),
    prisma.application.count({ where: { organisationId: context.organisationId } }),
    prisma.application.findMany({
      where: { organisationId: context.organisationId },
      take: 5,
      orderBy: { appliedAt: 'desc' },
      include: { candidate: true, job: { include: { requisition: true, recruiter: true, hiringManager: true } } },
    }),
    prisma.application.groupBy({
      by: ['currentStage'],
      where: { organisationId: context.organisationId },
      _count: { currentStage: true },
    }),
    prisma.interviewRound.findMany({
      where: {
        organisationId: context.organisationId,
        status: 'SCHEDULED',
        scheduledStartAt: { gte: new Date() },
      },
      include: {
        interviewProcess: {
          include: {
            application: {
              include: {
                candidate: true,
                job: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledStartAt: 'asc' },
      take: 5,
    }),
    prisma.jobRequisition.count({
      where: {
        organisationId: context.organisationId,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'OPEN', 'ON_HOLD'] },
      },
    }),
    prisma.savedCandidate.count({ where: { organisationId: context.organisationId } }),
    prisma.job.findMany({
      where: {
        organisationId: context.organisationId,
        status: 'OPEN',
        applicationDeadline: { not: null, lte: closingSoonDate, gte: new Date() },
      },
      orderBy: { applicationDeadline: 'asc' },
      take: 5,
      include: { requisition: true, recruiter: true, hiringManager: true },
    }),
    countOrZero(() => prisma.organisationInvitation.count({
      where: {
        organisationId: context.organisationId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })),
    countOrZero(() => prisma.offer.count({ where: { organisationId: context.organisationId, status: 'DRAFT' } })),
    countOrZero(() => prisma.offer.count({ where: { organisationId: context.organisationId, status: 'PENDING_APPROVAL' } })),
    countOrZero(() => prisma.offer.count({ where: { organisationId: context.organisationId, status: { in: ['RELEASED', 'VIEWED'] } } })),
    countOrZero(() => prisma.offer.count({ where: { organisationId: context.organisationId, status: 'ACCEPTED' } })),
    countOrZero(() => prisma.offer.count({ where: { organisationId: context.organisationId, status: { in: ['ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED'] } } })),
  ]);

  return {
    organisation: context.activeMembership.organisation,
    jobsCount,
    activeJobsCount,
    applicantsCount,
    recentApplications: recentApplications.map((application) =>
      serializeApplication(application, { includeCandidatePrivate: true })
    ),
    pipelineCounts,
    upcomingInterviews: upcomingInterviews.map((round) => ({
      id: round.id,
      roundName: round.roundName,
      scheduledStartAt: round.scheduledStartAt?.toISOString(),
      scheduledEndAt: round.scheduledEndAt?.toISOString(),
      applicationId: round.interviewProcess.application.id,
      candidateName: round.interviewProcess.application.candidate.fullName,
      jobTitle: round.interviewProcess.application.job.title,
    })),
    openRequisitions,
    savedCandidatesCount,
    pendingInvitationsCount,
    offersDraftCount,
    offersPendingApprovalCount,
    offersReleasedCount,
    offersAcceptedCount,
    upcomingJoinersCount,
    jobsClosingSoon: jobsClosingSoon.map((job) => serializeJob(job, { includeRequisition: true })),
  };
}

export async function getCandidateDashboard(candidateId) {
  const [applicationsCount, applications, profile] = await Promise.all([
    prisma.application.count({ where: { candidateId } }),
    prisma.application.findMany({
      where: { candidateId },
      include: {
        job: { include: { recruiter: { include: { recruiterProfile: { include: { organisation: true } } } }, requisition: true } },
        candidate: true,
      },
      take: 5,
      orderBy: { appliedAt: 'desc' },
    }),
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
  ]);

  const suggestedJobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      skillsRequired: { hasSome: profile?.skills || [] },
    },
    take: 6,
    orderBy: { createdAt: 'desc' },
    include: { requisition: true },
  });

  return {
    applicationsCount,
    resumeViews: profile?.profileViews || 0,
    recentApplications: applications.map((application) =>
      serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true })
    ),
    suggestedJobs: suggestedJobs.map((job) => serializeJob(job, { includeRequisition: true })),
  };
}
