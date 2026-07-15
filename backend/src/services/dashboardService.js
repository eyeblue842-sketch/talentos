import { prisma } from '../config/db.js';
import { serializeApplication, serializeJob } from '../serializers/index.js';

export async function getRecruiterDashboard(recruiterId) {
  const [jobsCount, applicantsCount, recentApplications, pipelineCounts] = await Promise.all([
    prisma.job.count({ where: { recruiterId } }),
    prisma.application.count({ where: { job: { recruiterId } } }),
    prisma.application.findMany({
      where: { job: { recruiterId } },
      take: 5,
      orderBy: { appliedAt: 'desc' },
      include: { candidate: true, job: true },
    }),
    prisma.application.groupBy({
      by: ['currentStage'],
      where: { job: { recruiterId } },
      _count: { currentStage: true },
    }),
  ]);

  return {
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
      include: { job: { include: { recruiter: { include: { recruiterProfile: true } } } }, candidate: true },
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
  });

  return {
    applicationsCount,
    resumeViews: profile?.profileViews || 0,
    recentApplications: applications.map((application) =>
      serializeApplication(application, { includeCoverLetter: true, includeCandidatePrivate: true })
    ),
    suggestedJobs: suggestedJobs.map((job) => serializeJob(job)),
  };
}
