import { prisma } from '../config/db.js';
import {
  serializeCandidateNotification,
  serializeCandidateProfile,
  serializePublicJob,
  serializeSavedJob,
} from '../serializers/index.js';
import { buildPublicJobWhere } from './publicPortalService.js';
import { recordAuditLog } from './auditLogService.js';

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

function maybeArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstNonEmpty(values = []) {
  return values.find((value) => value != null && value !== '' && (!Array.isArray(value) || value.length));
}

const bestEffortPrismaErrorCodes = new Set([
  'P2002',
  'P2003',
  'P2011',
]);

const deploymentFailureCodes = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2021',
  'P2022',
]);

function logSecondaryFailure(operation, error, metadata = {}) {
  console.error(JSON.stringify({
    code: 'CANDIDATE_SECONDARY_OPERATION_FAILED',
    operation,
    prismaCode: error?.code || null,
    message: error?.message || 'Unknown error',
    metadata,
  }));
}

function isDeploymentFailure(error) {
  return deploymentFailureCodes.has(error?.code);
}

async function recordCandidateActivity(candidateId, type, metadata = {}) {
  if (!prisma.candidateActivity?.create) {
    throw new Error('Prisma candidateActivity delegate is unavailable. Regenerate the Prisma client or update the test mocks.');
  }

  try {
    await prisma.candidateActivity.create({
      data: {
        candidateId,
        type,
        metadata,
        jobId: metadata.jobId || null,
        applicationId: metadata.applicationId || null,
        userId: metadata.userId || null,
      },
    });
  } catch (error) {
    if (isDeploymentFailure(error)) {
      throw error;
    }

    if (bestEffortPrismaErrorCodes.has(error?.code)) {
      logSecondaryFailure('candidateActivity.create', error, {
        candidateId,
        type,
        jobId: metadata.jobId || null,
        applicationId: metadata.applicationId || null,
      });
      return;
    }

    throw error;
  }
}

async function recordCandidateAuditLog(payload, options = {}) {
  try {
    await recordAuditLog(payload);
  } catch (error) {
    if (options.bestEffort && !isDeploymentFailure(error) && bestEffortPrismaErrorCodes.has(error?.code)) {
      logSecondaryFailure('auditLog.create', error, {
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId || null,
      });
      return;
    }

    throw error;
  }
}

function profileCompletionSections(profile) {
  const sections = [
    {
      key: 'basic_details',
      label: 'Basic details',
      weight: 20,
      complete: Boolean(profile.fullName && profile.currentTitle && profile.location),
    },
    {
      key: 'resume',
      label: 'Resume availability',
      weight: 20,
      complete: Boolean(profile.resumeUrl || profile.latestResumeAssetId || profile.resumeBuilder),
    },
    {
      key: 'skills',
      label: 'Skills',
      weight: 15,
      complete: maybeArray(profile.skills).length >= 3,
    },
    {
      key: 'experience',
      label: 'Experience',
      weight: 15,
      complete: typeof profile.totalExperience === 'number' && profile.totalExperience >= 0,
    },
    {
      key: 'preferences',
      label: 'Preferences',
      weight: 15,
      complete: maybeArray(profile.preferredRoles).length > 0
        && maybeArray(profile.preferredLocations).length > 0
        && maybeArray(profile.workplacePreferences).length > 0
        && maybeArray(profile.employmentPreferences).length > 0,
    },
    {
      key: 'summary',
      label: 'Professional summary',
      weight: 10,
      complete: Boolean(profile.headline && profile.summary),
    },
    {
      key: 'links',
      label: 'Professional links',
      weight: 5,
      complete: Boolean(firstNonEmpty([profile.linkedInUrl, profile.portfolioUrl, profile.githubUrl])),
    },
  ];

  return sections;
}

export function calculateProfileCompletion(profile) {
  const sections = profileCompletionSections(profile);
  const completed = sections.filter((section) => section.complete);
  const missing = sections.filter((section) => !section.complete);
  const percentage = Math.round(completed.reduce((total, section) => total + section.weight, 0));

  return {
    percentage,
    completedSections: completed.map((section) => section.label),
    missingSections: missing.map((section) => section.label),
    recommendedNextAction: missing[0]
      ? `Complete ${missing[0].label.toLowerCase()}.`
      : 'Keep your profile current as your job search evolves.',
    updatedAt: profile.updatedAt?.toISOString?.() || profile.updatedAt || null,
    sections: sections.map((section) => ({
      key: section.key,
      label: section.label,
      weight: section.weight,
      complete: section.complete,
    })),
  };
}

function buildSavedJobWhere(candidateId, filters = {}) {
  const filter = String(filters.filter || 'ALL').toUpperCase();

  if (filter === 'OPEN') {
    return {
      candidateId,
      job: buildPublicJobWhere(),
    };
  }

  if (filter === 'CLOSING_SOON') {
    const soon = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
    return {
      candidateId,
      job: {
        ...buildPublicJobWhere(),
        OR: [
          { applicationClosesAt: { lte: soon, gte: new Date() } },
          { applicationDeadline: { lte: soon, gte: new Date() } },
        ],
      },
    };
  }

  if (filter === 'CLOSED') {
    return {
      candidateId,
      OR: [
        { job: null },
        {
          job: {
            OR: [
              { status: { not: 'OPEN' } },
              { archivedAt: { not: null } },
              { applicationClosesAt: { lt: new Date() } },
              { applicationDeadline: { lt: new Date() } },
            ],
          },
        },
      ],
    };
  }

  if (filter === 'APPLIED') {
    return {
      candidateId,
      job: {
        applications: {
          some: { candidateId },
        },
      },
    };
  }

  return { candidateId };
}

function buildSavedJobOrderBy(sort = 'recently_saved') {
  switch (String(sort).toLowerCase()) {
    case 'closing_soon':
      return [{ job: { applicationClosesAt: 'asc' } }, { createdAt: 'desc' }];
    case 'recently_posted':
      return [{ job: { createdAt: 'desc' } }, { createdAt: 'desc' }];
    case 'job_title':
      return [{ jobTitleSnapshot: 'asc' }, { createdAt: 'desc' }];
    case 'recently_saved':
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

function buildSettingsResponse(profile) {
  return {
    profileVisibility: profile.profileVisibility,
    recommendationEnabled: profile.recommendationEnabled,
    preferredRoles: profile.preferredRoles,
    preferredIndustries: profile.preferredIndustries || [],
    preferredCompanySizes: profile.preferredCompanySizes || [],
    preferredLocations: profile.preferredLocations,
    willingToRelocate: profile.willingToRelocate,
    workplacePreferences: profile.workplacePreferences,
    employmentPreferences: profile.employmentPreferences,
    minExpectedSalary: profile.minExpectedSalary,
    preferredCurrency: profile.preferredCurrency,
    availability: profile.availability,
    noticePeriodDays: profile.noticePeriodDays,
    workAuthorization: profile.workAuthorization,
    requiresVisaSponsorship: profile.requiresVisaSponsorship,
    travelWillingness: profile.travelWillingness,
    jobAlertEnabled: profile.jobAlertEnabled,
    jobAlertFrequency: profile.jobAlertFrequency,
    notifyForSavedJobUpdates: profile.notifyForSavedJobUpdates,
    notifyForApplicationUpdates: profile.notifyForApplicationUpdates,
    notifyForRecommendations: profile.notifyForRecommendations,
    notifyForInterviews: profile.notifyForInterviews,
    notifyForOffers: profile.notifyForOffers,
    notifyForProfileReminders: profile.notifyForProfileReminders,
    notifyForMarketing: profile.notifyForMarketing,
  };
}

function scoreRecommendedJob(profile, job) {
  const profileSkills = new Set(maybeArray(profile.skills).map(normalize));
  const jobSkills = maybeArray(job.skillsRequired).map(normalize);
  const preferredLocations = maybeArray(profile.preferredLocations).map(normalize);
  const preferredRoles = maybeArray(profile.preferredRoles).map(normalize);
  const preferredIndustries = maybeArray(profile.preferredIndustries).map(normalize);

  const skillOverlap = jobSkills.filter((skill) => profileSkills.has(skill)).length;
  const title = normalize(job.title);
  const location = normalize(job.location);
  const employmentType = normalize(job.employmentType);
  const workplaceType = normalize(job.workplaceType);

  let score = 0;
  const reasons = [];

  if (skillOverlap > 0) {
    score += skillOverlap * 18;
    reasons.push('Matches your skills');
  }
  if (preferredLocations.includes(location)) {
    score += 16;
    reasons.push('Matches your preferred location');
  } else if (preferredLocations.includes('remote') && location.includes('remote')) {
    score += 12;
    reasons.push('Remote role');
  }
  if (maybeArray(profile.workplacePreferences).map(normalize).includes(workplaceType)) {
    score += 10;
    reasons.push('Matches your work mode');
  }
  if (maybeArray(profile.employmentPreferences).map(normalize).includes(employmentType)) {
    score += 8;
    reasons.push('Matches your employment type');
  }
  if (preferredRoles.some((role) => title.includes(role))) {
    score += 14;
    reasons.push('Similar to your preferred roles');
  }
  if (preferredIndustries.includes(normalize(job.organisation?.industry))) {
    score += 6;
    reasons.push('Fits your preferred industry');
  }
  if (typeof profile.totalExperience === 'number' && profile.totalExperience >= job.experienceMin && profile.totalExperience <= job.experienceMax) {
    score += 10;
  }

  const ageInDays = Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000));
  score += Math.max(0, 8 - ageInDays);

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 3),
  };
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

export async function updateCandidateSelfProfile(candidateId, payload, requestMeta = {}) {
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

  await recordCandidateActivity(candidateId, 'PROFILE_UPDATED');
  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.profile.update',
      entityType: 'CandidateProfile',
      entityId: candidateId,
      metadata: { candidateId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  }

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion: calculateProfileCompletion(profile),
  };
}

export async function updateCandidateSettings(candidateId, payload, requestMeta = {}) {
  const profile = await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      profileVisibility: payload.profileVisibility,
      recommendationEnabled: payload.recommendationEnabled,
      preferredRoles: payload.preferredRoles ? normalizeStringArray(payload.preferredRoles) : undefined,
      preferredIndustries: payload.preferredIndustries ? normalizeStringArray(payload.preferredIndustries) : undefined,
      preferredCompanySizes: payload.preferredCompanySizes ? normalizeStringArray(payload.preferredCompanySizes) : undefined,
      preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
      willingToRelocate: payload.willingToRelocate,
      workplacePreferences: payload.workplacePreferences,
      employmentPreferences: payload.employmentPreferences,
      minExpectedSalary: payload.minExpectedSalary ?? undefined,
      preferredCurrency: payload.preferredCurrency || null,
      availability: payload.availability,
      noticePeriodDays: payload.noticePeriodDays ?? undefined,
      workAuthorization: payload.workAuthorization || null,
      requiresVisaSponsorship: payload.requiresVisaSponsorship,
      travelWillingness: payload.travelWillingness || null,
      jobAlertEnabled: payload.jobAlertEnabled,
      jobAlertFrequency: payload.jobAlertFrequency,
      notifyForSavedJobUpdates: payload.notifyForSavedJobUpdates,
      notifyForApplicationUpdates: payload.notifyForApplicationUpdates,
      notifyForRecommendations: payload.notifyForRecommendations,
      notifyForInterviews: payload.notifyForInterviews,
      notifyForOffers: payload.notifyForOffers,
      notifyForProfileReminders: payload.notifyForProfileReminders,
      notifyForMarketing: payload.notifyForMarketing,
    },
    include: { resumeBuilder: true },
  });

  await recordCandidateActivity(candidateId, 'PREFERENCES_UPDATED');
  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.settings.update',
      entityType: 'CandidateProfile',
      entityId: candidateId,
      metadata: { candidateId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  }

  return {
    settings: buildSettingsResponse(profile),
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
    settings: buildSettingsResponse(profile),
    completion: calculateProfileCompletion(profile),
  };
}

export async function listSavedJobs(candidateId, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 12));
  const where = buildSavedJobWhere(candidateId, filters);

  const total = await prisma.savedJob.count({ where });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.savedJob.findMany({
    where,
    include: { job: { include: { organisation: true, applications: true } } },
    orderBy: buildSavedJobOrderBy(filters.sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((row) => serializeSavedJob(row, { saved: true })),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function saveJobForCandidate(candidateId, jobId, requestMeta = {}) {
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

  await recordCandidateActivity(candidateId, 'JOB_SAVED', { jobId });
  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.saved-job.create',
      entityType: 'SavedJob',
      entityId: savedJob.id,
      metadata: { candidateId, jobId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    }, { bestEffort: true });
  }

  return serializeSavedJob(savedJob, { saved: true });
}

export async function removeSavedJob(candidateId, jobId, requestMeta = {}) {
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
  await recordCandidateActivity(candidateId, 'JOB_UNSAVED', { jobId });
  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.saved-job.delete',
      entityType: 'SavedJob',
      entityId: savedJob.id,
      metadata: { candidateId, jobId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    }, { bestEffort: true });
  }
  return { deleted: true };
}

export async function recordCandidateJobView(candidateId, jobId, payload = {}) {
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      ...buildPublicJobWhere(),
    },
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  await prisma.candidateJobView.upsert({
    where: {
      candidateId_jobId: {
        candidateId,
        jobId,
      },
    },
    update: {
      lastViewedAt: new Date(),
      viewCount: { increment: 1 },
      source: payload.source || undefined,
      referrerClassification: payload.referrerClassification || undefined,
    },
    create: {
      candidateId,
      jobId,
      source: payload.source || null,
      referrerClassification: payload.referrerClassification || null,
    },
  });

  await recordCandidateActivity(candidateId, 'JOB_VIEWED', { jobId });
  return { recorded: true };
}

export async function listCandidateJobViews(candidateId, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 8));
  const where = { candidateId };
  const total = await prisma.candidateJobView.count({ where });
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await prisma.candidateJobView.findMany({
    where,
    include: { job: { include: { organisation: true } } },
    orderBy: [{ lastViewedAt: 'desc' }, { id: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows
      .filter((row) => row.job)
      .map((row) => ({
        id: row.id,
        viewedAt: row.lastViewedAt?.toISOString?.() || row.lastViewedAt,
        viewCount: row.viewCount,
        job: serializePublicJob(row.job),
      })),
    meta: buildMeta(total, page, pageSize),
  };
}

export const getCandidateJobViews = listCandidateJobViews;

export async function clearCandidateJobViews(candidateId, requestMeta = {}) {
  await prisma.candidateJobView.deleteMany({ where: { candidateId } });
  await recordCandidateActivity(candidateId, 'RECENT_HISTORY_CLEARED');
  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.recent-jobs.clear',
      entityType: 'CandidateJobView',
      metadata: { candidateId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  }
  return { deleted: true };
}

export async function getCandidateRecommendations(candidateId, options = {}) {
  const requestedPage = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(24, Math.max(1, Number(options.pageSize) || 6));
  const excludeSaved = Boolean(options.excludeSaved);

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
      take: 60,
    }),
  ]);

  const excludedJobIds = new Set([
    ...(excludeSaved ? savedJobs.map((row) => row.jobId) : []),
    ...appliedJobs.map((row) => row.jobId),
  ].filter(Boolean));

  const hasStrongSignals = maybeArray(profile.skills).length >= 3
    || maybeArray(profile.preferredRoles).length > 0
    || maybeArray(profile.preferredLocations).length > 0
    || maybeArray(profile.preferredIndustries).length > 0;

  const scoredRows = hasStrongSignals && profile.recommendationEnabled
    ? openJobs
      .filter((job) => !excludedJobIds.has(job.id))
      .map((job) => ({ job, ...scoreRecommendedJob(profile, job) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.job.createdAt - a.job.createdAt || a.job.id.localeCompare(b.job.id))
    : [];

  const fallbackRows = scoredRows.length
    ? []
    : openJobs
      .filter((job) => !excludedJobIds.has(job.id))
      .slice(0, 24)
      .map((job) => ({
        job,
        score: 0,
        reasons: ['Recently posted'],
      }));

  const rows = scoredRows.length ? scoredRows : fallbackRows;
  const total = rows.length;
  const page = clampPage(total, requestedPage, pageSize);
  const paged = rows.slice((page - 1) * pageSize, ((page - 1) * pageSize) + pageSize);

  return {
    completion,
    isFallback: scoredRows.length === 0,
    prompt: scoredRows.length === 0
      ? 'Add your skills, preferred roles, and locations for sharper recommendations.'
      : null,
    recommendedJobs: paged.map((item) => ({
      ...serializePublicJob(item.job),
      recommendationScore: item.score,
      reasons: item.reasons,
    })),
    meta: buildMeta(total, page, pageSize),
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
  const recentViewsPromise = listCandidateJobViews(candidateId, { page: 1, pageSize: 4 });
  const recommendationPromise = getCandidateRecommendations(candidateId, { excludeSaved: true, page: 1, pageSize: 4 });

  const [savedJobsCount, applicationsCount, savedJobs, applications, unreadNotificationsCount, notifications, interviews, offersCount, recentViews, recommendations] = await Promise.all([
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
    countOrZero(() => prisma.offer.count({
      where: {
        candidateId,
        status: {
          in: ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED'],
        },
      },
    })),
    recentViewsPromise,
    recommendationPromise,
  ]);

  const activeApplicationsCount = applications.filter((item) => !['Rejected', 'Withdrawn', 'Selected'].includes(item.statusLabel)).length;
  const interviewApplicationsCount = applications.filter((item) => item.currentStage === 'INTERVIEW_SCHEDULED').length;
  const withdrawnApplicationsCount = applications.filter((item) => item.statusLabel === 'Withdrawn').length;
  const closedApplicationsCount = applications.filter((item) => ['Rejected', 'Selected'].includes(item.statusLabel)).length;

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion,
    metrics: {
      savedJobsCount,
      applicationsCount,
      unreadNotificationsCount,
      profileViews: profile.profileViews,
      activeApplicationsCount,
      interviewApplicationsCount,
      offersCount,
      closedApplicationsCount,
      withdrawnApplicationsCount,
    },
    savedJobs: savedJobs.map((row) => serializeSavedJob(row, { saved: true })),
    recentApplications: applications.map((application) => ({
      id: application.id,
      statusLabel: application.statusLabel,
      appliedAt: application.appliedAt.toISOString(),
      job: serializePublicJob(application.job),
    })),
    recentUpdates: notifications.slice(0, 4).map((row) => serializeCandidateNotification(row)),
    recentJobs: recentViews.items,
    upcomingInterviews: interviews.map((row) => ({
      id: row.id,
      roundName: row.roundName,
      status: row.status,
      scheduledStartAt: row.scheduledStartAt?.toISOString(),
      scheduledEndAt: row.scheduledEndAt?.toISOString(),
      candidateInstructions: row.candidateInstructions,
      meetingMode: row.meetingMode,
      meetingLink: row.meetingLink,
      job: serializePublicJob(row.interviewProcess.application.job),
    })),
    notifications: notifications.map((row) => serializeCandidateNotification(row)),
    recommendations,
    quickActions: [
      { label: 'Browse Jobs', href: '/candidate/jobs' },
      { label: 'Update Profile', href: '/candidate/profile' },
      { label: 'Upload Resume', href: '/candidate/profile' },
      { label: 'View Applications', href: '/candidate/applications' },
      { label: 'Manage Preferences', href: '/candidate/settings' },
    ],
  };
}
