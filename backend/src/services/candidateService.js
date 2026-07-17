import { prisma } from '../config/db.js';
import {
  serializeCandidateNotification,
  serializeCandidateProfile,
  serializePublicJob,
  serializeSavedJob,
} from '../serializers/index.js';
import { buildPublicJobWhere } from './publicPortalService.js';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function buildMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function clampPage(total, requestedPage, pageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, requestedPage), pageCount);
}

export function calculateProfileCompletion(profile) {
  const sections = [
    {
      key: 'basic_details',
      label: 'Basic details',
      complete: Boolean(profile.fullName && profile.currentTitle),
    },
    {
      key: 'headline',
      label: 'Professional headline',
      complete: Boolean(profile.headline),
    },
    {
      key: 'location',
      label: 'Location',
      complete: Boolean(profile.location),
    },
    {
      key: 'experience',
      label: 'Experience',
      complete: typeof profile.totalExperience === 'number' && profile.totalExperience >= 0,
    },
    {
      key: 'skills',
      label: 'Skills',
      complete: (profile.skills || []).length >= 3,
    },
    {
      key: 'preferences',
      label: 'Preferences',
      complete: (profile.preferredRoles || []).length > 0
        && (profile.preferredLocations || []).length > 0
        && (profile.workplacePreferences || []).length > 0,
    },
    {
      key: 'summary',
      label: 'Summary',
      complete: Boolean(profile.summary),
    },
    {
      key: 'resume',
      label: 'Resume availability',
      complete: Boolean(profile.resumeUrl || profile.resumeBuilder),
    },
  ];

  const completed = sections.filter((section) => section.complete);
  const missing = sections.filter((section) => !section.complete);
  const percentage = Math.round((completed.length / sections.length) * 100);

  return {
    percentage,
    completedSections: completed.map((section) => section.label),
    missingSections: missing.map((section) => section.label),
    recommendedNextAction: missing[0]
      ? `Complete ${missing[0].label.toLowerCase()}.`
      : 'Keep your profile current as your job search evolves.',
  };
}

function scoreRecommendedJob(profile, job) {
  const profileSkills = new Set((profile.skills || []).map(normalize));
  const jobSkills = (job.skillsRequired || []).map(normalize);
  const preferredLocations = (profile.preferredLocations || []).map(normalize);
  const preferredRoles = (profile.preferredRoles || []).map(normalize);

  const skillOverlap = jobSkills.filter((skill) => profileSkills.has(skill)).length;
  const title = normalize(job.title);
  const location = normalize(job.location);
  const employmentType = normalize(job.employmentType);
  const workplaceType = normalize(job.workplaceType);

  let score = skillOverlap * 18;
  if (preferredLocations.includes(location)) score += 15;
  if (preferredLocations.includes('remote') && location.includes('remote')) score += 12;
  if ((profile.workplacePreferences || []).map(normalize).includes(workplaceType)) score += 10;
  if ((profile.employmentPreferences || []).map(normalize).includes(employmentType)) score += 8;
  if (preferredRoles.some((role) => title.includes(role))) score += 15;
  if (typeof profile.totalExperience === 'number' && profile.totalExperience >= job.experienceMin && profile.totalExperience <= job.experienceMax) score += 12;

  const ageInDays = Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000));
  score += Math.max(0, 10 - ageInDays);

  return score;
}

export async function getCandidateSelfProfile(candidateId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { resumeBuilder: true },
  });

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion: calculateProfileCompletion(profile),
  };
}

export async function updateCandidateSelfProfile(candidateId, payload) {
  const profile = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      ...payload,
      skills: payload.skills ? normalizeStringArray(payload.skills) : undefined,
      preferredRoles: payload.preferredRoles ? normalizeStringArray(payload.preferredRoles) : undefined,
      preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
      profileImageUrl: payload.profileImageUrl || null,
      portfolioUrl: payload.portfolioUrl || null,
      linkedInUrl: payload.linkedInUrl || null,
      githubUrl: payload.githubUrl || null,
    },
    include: { resumeBuilder: true },
  });

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion: calculateProfileCompletion(profile),
  };
}

export async function updateCandidateSettings(candidateId, payload) {
  const profile = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      profileVisibility: payload.profileVisibility,
      recommendationEnabled: payload.recommendationEnabled,
      preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
      workplacePreferences: payload.workplacePreferences,
      employmentPreferences: payload.employmentPreferences,
      notifyForSavedJobUpdates: payload.notifyForSavedJobUpdates,
      notifyForRecommendations: payload.notifyForRecommendations,
      notifyForInterviews: payload.notifyForInterviews,
    },
    include: { resumeBuilder: true },
  });

  return {
    settings: {
      profileVisibility: profile.profileVisibility,
      recommendationEnabled: profile.recommendationEnabled,
      preferredLocations: profile.preferredLocations,
      workplacePreferences: profile.workplacePreferences,
      employmentPreferences: profile.employmentPreferences,
      notifyForSavedJobUpdates: profile.notifyForSavedJobUpdates,
      notifyForRecommendations: profile.notifyForRecommendations,
      notifyForInterviews: profile.notifyForInterviews,
    },
    completion: calculateProfileCompletion(profile),
  };
}

export async function getCandidateSettings(candidateId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { resumeBuilder: true },
  });

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    settings: {
      profileVisibility: profile.profileVisibility,
      recommendationEnabled: profile.recommendationEnabled,
      preferredLocations: profile.preferredLocations,
      workplacePreferences: profile.workplacePreferences,
      employmentPreferences: profile.employmentPreferences,
      notifyForSavedJobUpdates: profile.notifyForSavedJobUpdates,
      notifyForRecommendations: profile.notifyForRecommendations,
      notifyForInterviews: profile.notifyForInterviews,
    },
    completion: calculateProfileCompletion(profile),
  };
}

export async function listSavedJobs(candidateId, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const where = { candidateId };

  const total = await prisma.savedJob.count({ where });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.savedJob.findMany({
    where,
    include: { job: { include: { organisation: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((row) => serializeSavedJob(row, { saved: true })),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function saveJobForCandidate(candidateId, jobId) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      ...buildPublicJobWhere(),
    },
    include: { organisation: true },
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  const savedJob = await prisma.savedJob.upsert({
    where: {
      candidateId_jobId: {
        candidateId,
        jobId,
      },
    },
    update: {
      organisationId: job.organisationId,
      jobSlugSnapshot: job.slug,
      jobTitleSnapshot: job.title,
      organisationNameSnapshot: job.organisation?.name || 'Careeriz employer',
    },
    create: {
      candidateId,
      jobId,
      organisationId: job.organisationId,
      jobSlugSnapshot: job.slug,
      jobTitleSnapshot: job.title,
      organisationNameSnapshot: job.organisation?.name || 'Careeriz employer',
    },
    include: { job: { include: { organisation: true } } },
  });

  return serializeSavedJob(savedJob, { saved: true });
}

export async function removeSavedJob(candidateId, jobId) {
  const savedJob = await prisma.savedJob.findFirst({
    where: {
      candidateId,
      jobId,
    },
  });

  if (!savedJob) {
    const error = new Error('Saved job not found.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.savedJob.delete({ where: { id: savedJob.id } });
  return { deleted: true };
}

export async function getCandidateRecommendations(candidateId, { excludeSaved = false } = {}) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { resumeBuilder: true },
  });

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const completion = calculateProfileCompletion(profile);
  const [savedJobs, appliedJobs, openJobs] = await Promise.all([
    prisma.savedJob.findMany({ where: { candidateId }, select: { jobId: true } }),
    prisma.application.findMany({ where: { candidateId }, select: { jobId: true } }),
    prisma.job.findMany({
      where: buildPublicJobWhere(),
      include: { organisation: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 40,
    }),
  ]);

  const excludedJobIds = new Set([
    ...(excludeSaved ? savedJobs.map((row) => row.jobId) : []),
    ...appliedJobs.map((row) => row.jobId),
  ].filter(Boolean));

  const hasStrongSignals = (profile.skills || []).length >= 3
    || (profile.preferredRoles || []).length > 0
    || (profile.preferredLocations || []).length > 0;

  const ranked = hasStrongSignals && profile.recommendationEnabled
    ? openJobs
        .filter((job) => !excludedJobIds.has(job.id))
        .map((job) => ({ job, score: scoreRecommendedJob(profile, job) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.job.createdAt - a.job.createdAt || a.job.id.localeCompare(b.job.id))
        .slice(0, 6)
        .map((item) => serializePublicJob(item.job))
    : [];

  const fallbackJobs = ranked.length
    ? []
    : openJobs
        .filter((job) => !excludedJobIds.has(job.id))
        .slice(0, 6)
        .map((job) => serializePublicJob(job));

  return {
    completion,
    isFallback: ranked.length === 0,
    prompt: ranked.length === 0
      ? 'Add your skills, preferred roles, and locations for sharper recommendations.'
      : null,
    recommendedJobs: ranked.length ? ranked : fallbackJobs,
  };
}

export async function listCandidateNotifications(candidateId, userId, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const where = {
    recipientUserId: userId,
    ...(filters.unreadOnly ? { readAt: null } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  const total = await prisma.notification.count({ where });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((row) => serializeCandidateNotification(row)),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function markCandidateNotificationRead(userId, notificationId) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      recipientUserId: userId,
    },
  });

  if (!notification) {
    const error = new Error('Notification not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: notification.readAt || new Date() },
  });

  return serializeCandidateNotification(updated);
}

export async function markAllCandidateNotificationsRead(userId) {
  await prisma.notification.updateMany({
    where: {
      recipientUserId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { updated: true };
}

export async function getCandidateDashboard(candidateId, userId) {
  const profile = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { resumeBuilder: true },
  });

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const completion = calculateProfileCompletion(profile);
  const [savedJobsCount, applicationsCount, savedJobs, applications, unreadNotificationsCount, notifications, interviews, recommendations] = await Promise.all([
    prisma.savedJob.count({ where: { candidateId } }),
    prisma.application.count({ where: { candidateId } }),
    prisma.savedJob.findMany({
      where: { candidateId },
      include: { job: { include: { organisation: true } } },
      take: 4,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    prisma.application.findMany({
      where: { candidateId },
      include: { job: { include: { organisation: true } } },
      orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
    prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
    prisma.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
    prisma.interviewRound.findMany({
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
    }),
    getCandidateRecommendations(candidateId, { excludeSaved: true }),
  ]);

  const statusCounts = applications.reduce((accumulator, application) => {
    accumulator[application.statusLabel] = (accumulator[application.statusLabel] || 0) + 1;
    return accumulator;
  }, {});

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion,
    metrics: {
      savedJobsCount,
      applicationsCount,
      unreadNotificationsCount,
      profileViews: profile.profileViews,
    },
    savedJobs: savedJobs.map((row) => serializeSavedJob(row, { saved: true })),
    recentApplications: applications.map((application) => ({
      id: application.id,
      statusLabel: application.statusLabel,
      appliedAt: application.appliedAt.toISOString(),
      job: serializePublicJob(application.job),
    })),
    applicationStatusCounts: statusCounts,
    upcomingInterviews: interviews.map((row) => ({
      id: row.id,
      roundName: row.roundName,
      scheduledStartAt: row.scheduledStartAt?.toISOString(),
      scheduledEndAt: row.scheduledEndAt?.toISOString(),
      job: serializePublicJob(row.interviewProcess.application.job),
    })),
    notifications: notifications.map((row) => serializeCandidateNotification(row)),
    recommendations,
  };
}
