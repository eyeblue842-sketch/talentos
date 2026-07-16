import { prisma } from '../config/db.js';
import { serializeApplication, serializeJob } from '../serializers/index.js';
import { requireOrganisationContext } from './organisationAccessService.js';

export async function getRecruiterDashboard(actorUser, organisationId = null) {
  const context = await requireOrganisationContext(actorUser, organisationId);
  const [jobsCount, applicantsCount, recentApplications, pipelineCounts] = await Promise.all([
    prisma.job.count({ where: { organisationId: context.organisationId } }),
    prisma.application.count({ where: { organisationId: context.organisationId } }),
    prisma.application.findMany({
      where: { organisationId: context.organisationId },
      take: 5,
      orderBy: { appliedAt: 'desc' },
      include: { candidate: true, job: { include: { requisition: true } } },
    }),
    prisma.application.groupBy({
      by: ['currentStage'],
      where: { organisationId: context.organisationId },
      _count: { currentStage: true },
    }),
  ]);

  return {
    organisation: context.activeMembership.organisation,
    jobsCount,
    applicantsCount,
    recentApplications: recentApplications.map((application) =>
      serializeApplication(application, { includeCandidatePrivate: true })
    ),
    pipelineCounts,
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
