import { prisma } from '../../config/db.js';

export function hasCandidateActivityCreateDelegate() {
  return Boolean(prisma.candidateActivity?.create);
}

export function createCandidateActivityRecord(data) {
  return prisma.candidateActivity.create({ data });
}

export function findCandidateProfileWithLatestResume(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { latestResumeAsset: true },
  });
}

export function updateCandidateProfileWithLatestResume(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
    include: { latestResumeAsset: true },
  });
}

export function findCandidateSettingsProfile(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { latestResumeAsset: true },
  });
}

export function updateCandidateSettingsProfile(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
    include: { latestResumeAsset: true },
  });
}

export function findCandidateOnboardingProfile(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: {
      resumeAssets: {
        where: { kind: 'RESUME', status: { not: 'DELETED' } },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      },
    },
  });
}

export function updateCandidateOnboardingProfile(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
    include: {
      resumeAssets: {
        where: { kind: 'RESUME', status: { not: 'DELETED' } },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      },
    },
  });
}

export function markCandidateOnboardingCompleted(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
  });
}

export function countSavedJobs(where) {
  return prisma.savedJob.count({ where });
}

export function findSavedJobs(where, orderBy, skip, take) {
  return prisma.savedJob.findMany({
    where,
    include: { job: { include: { organisation: true, applications: true } } },
    orderBy,
    skip,
    take,
  });
}

export function findPublicJobWithOrganisation(where) {
  return prisma.job.findFirst({
    where,
    include: { organisation: true },
  });
}

export function upsertSavedJobRecord(candidateId, jobId, data) {
  return prisma.savedJob.upsert({
    where: {
      candidateId_jobId: {
        candidateId,
        jobId,
      },
    },
    update: data,
    create: {
      candidateId,
      jobId,
      ...data,
    },
    include: { job: { include: { organisation: true } } },
  });
}

export function findSavedJobByCandidateAndJob(candidateId, jobId) {
  return prisma.savedJob.findFirst({
    where: { candidateId, jobId },
  });
}

export function deleteSavedJobById(id) {
  return prisma.savedJob.delete({ where: { id } });
}

export function findPublicJob(where) {
  return prisma.job.findFirst({ where });
}

export function upsertCandidateJobViewRecord(candidateId, jobId, createData, updateData) {
  return prisma.candidateJobView.upsert({
    where: {
      candidateId_jobId: {
        candidateId,
        jobId,
      },
    },
    update: updateData,
    create: {
      candidateId,
      jobId,
      ...createData,
    },
  });
}

export function countCandidateJobViews(where) {
  return prisma.candidateJobView.count({ where });
}

export function findCandidateJobViews(where, skip, take) {
  return prisma.candidateJobView.findMany({
    where,
    include: { job: { include: { organisation: true } } },
    orderBy: [{ lastViewedAt: 'desc' }, { id: 'asc' }],
    skip,
    take,
  });
}

export function deleteCandidateJobViews(candidateId) {
  return prisma.candidateJobView.deleteMany({ where: { candidateId } });
}

export function findCandidateProfileWithResumeBuilder(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { resumeBuilder: true },
  });
}

export function findCandidateSavedJobIds(candidateId) {
  return prisma.savedJob.findMany({ where: { candidateId }, select: { jobId: true } });
}

export function findCandidateApplicationJobIds(candidateId) {
  return prisma.application.findMany({ where: { candidateId }, select: { jobId: true } });
}

export function findRecommendationOpenJobs(where) {
  return prisma.job.findMany({
    where,
    include: { organisation: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 60,
  });
}

export function countNotifications(where) {
  return prisma.notification.count({ where });
}

export function findNotifications(where, skip, take) {
  return prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip,
    take,
  });
}

export function findNotificationForRecipient(notificationId, userId) {
  return prisma.notification.findFirst({
    where: { id: notificationId, recipientUserId: userId },
  });
}

export function updateNotificationReadAt(notificationId, readAt) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt },
  });
}

export function markAllNotificationsReadForUser(userId) {
  return prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export function countApplications(where) {
  return prisma.application.count({ where });
}

export function findDashboardSavedJobs(candidateId) {
  return prisma.savedJob.findMany({
    where: { candidateId },
    include: { job: { include: { organisation: true } } },
    take: 4,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}

export function findDashboardApplications(candidateId) {
  return prisma.application.findMany({
    where: { candidateId },
    include: { job: { include: { organisation: true } } },
    orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }],
    take: 5,
  });
}

export function countUnreadNotificationsForUser(userId) {
  return prisma.notification.count({ where: { recipientUserId: userId, readAt: null } });
}

export function findRecentNotificationsForUser(userId) {
  return prisma.notification.findMany({
    where: { recipientUserId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 5,
  });
}

export function findScheduledInterviewRoundsForCandidate(candidateId) {
  return prisma.interviewRound.findMany({
    where: {
      interviewProcess: {
        application: {
          candidateId,
        },
      },
      status: 'SCHEDULED',
      scheduledStartAt: { gte: new Date() },
    },
    include: {
      interviewProcess: {
        include: {
          application: {
            include: {
              job: { include: { organisation: true } },
            },
          },
        },
      },
    },
    orderBy: { scheduledStartAt: 'asc' },
    take: 5,
  });
}

export function countCandidateOffers(where) {
  return prisma.offer.count({ where });
}

export function findCandidateOffers(where, take, includeOrganisation = true) {
  return prisma.offer.findMany({
    where,
    include: {
      job: includeOrganisation ? { include: { organisation: true } } : true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    ...(take ? { take } : {}),
  });
}

export function findCandidateResumeAssets(candidateId, take = undefined) {
  return prisma.resumeAsset.findMany({
    where: {
      candidateId,
      kind: 'RESUME',
      status: { not: 'DELETED' },
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
    ...(take ? { take } : {}),
  });
}

export function findCandidateInterviewRoundsCenter(candidateId) {
  return prisma.interviewRound.findMany({
    where: {
      interviewProcess: {
        application: {
          candidateId,
        },
      },
    },
    include: {
      meeting: {
        include: {
          participants: true,
          rescheduleRequests: {
            include: { options: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      panelMembers: {
        include: { user: true },
      },
      interviewProcess: {
        include: {
          application: {
            include: {
              job: { include: { organisation: true } },
            },
          },
        },
      },
    },
    orderBy: [{ scheduledStartAt: 'asc' }, { createdAt: 'desc' }],
  });
}

export function findCandidateOffersCenter(candidateId) {
  return prisma.offer.findMany({
    where: { candidateId },
    include: {
      job: { include: { organisation: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
}

export function exportCandidateDataQueries(candidateId, userId) {
  return Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId } }),
    prisma.savedJob.findMany({ where: { candidateId }, include: { job: true } }),
    prisma.jobApplication.findMany({
      where: { candidateId },
      include: {
        job: true,
        application: true,
        resumeSnapshot: true,
        timeline: { where: { isCandidateVisible: true }, orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.interviewRound.findMany({
      where: {
        interviewProcess: {
          application: {
            candidateId,
          },
        },
      },
      include: {
        interviewProcess: { include: { application: true } },
      },
    }),
    prisma.offer.findMany({ where: { candidateId }, include: { job: true } }),
    prisma.resumeAsset.findMany({ where: { candidateId, kind: 'RESUME', status: { not: 'DELETED' } } }),
    prisma.notification.findMany({ where: { recipientUserId: userId }, orderBy: { createdAt: 'desc' }, take: 200 }),
  ]);
}

export function updateCandidateDataExportTimestamps(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
  });
}

export function findCandidateProfileById(candidateId) {
  return prisma.candidateProfile.findUnique({ where: { id: candidateId } });
}

export function updateCandidateAccountDeactivation(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
  });
}
