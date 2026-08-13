import {
  serializeCandidateNotification,
  serializeCandidateProfile,
  serializePublicJob,
  serializeSavedJob,
} from '../serializers/index.js';
import {
  deletePrivateFile,
  readPrivateFileNodeStream,
  storePrivateFile,
} from '../config/storage.js';
import { buildPublicJobWhere } from './publicPortalService.js';
import { recordAuditLog } from './auditLogService.js';
import { markCandidateIntelligenceStale } from '../intelligence/services/candidateIntelligenceService.js';
import { touchCandidateLastActive } from './candidateActivityService.js';
import {
  countApplications,
  countCandidateJobViews,
  countCandidateOffers,
  countNotifications,
  countSavedJobs,
  countUnreadNotificationsForUser,
  createCandidateActivityRecord,
  deleteCandidateJobViews,
  deleteSavedJobById,
  exportCandidateDataQueries,
  findCandidateApplicationJobIds,
  findCandidateInterviewRoundsCenter,
  findCandidateOffers,
  findCandidateOffersCenter,
  findCandidateOnboardingProfile,
  findCandidateProfileById,
  findCandidateProfileWithLatestResume,
  findCandidateProfileWithResumeBuilder,
  findCandidateResumeAssets,
  findCandidateSavedJobIds,
  findCandidateSettingsProfile,
  findCandidateJobViews,
  findDashboardApplications,
  findDashboardSavedJobs,
  findNotifications,
  findNotificationForRecipient,
  findPublicJob,
  findPublicJobWithOrganisation,
  findRecentNotificationsForUser,
  findRecommendationOpenJobs,
  findSavedJobByCandidateAndJob,
  findSavedJobs,
  findScheduledInterviewRoundsForCandidate,
  hasCandidateActivityCreateDelegate,
  markAllNotificationsReadForUser,
  markCandidateOnboardingCompleted,
  updateCandidateAccountDeactivation,
  updateCandidateDataExportTimestamps,
  updateCandidateOnboardingProfile,
  updateCandidateProfileWithLatestResume,
  updateCandidateSettingsProfile,
  updateNotificationReadAt,
  upsertCandidateJobViewRecord,
  upsertSavedJobRecord,
} from '../repositories/candidate/candidateRepository.js';
import {
  normalizeCandidateProfileForPresentation,
  sanitizeCandidateDisplayField,
} from './candidateProfileSanitizer.js';

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

const PROFILE_PHOTO_PREFIX = 'candidate-profile-photos';
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PROFILE_PHOTO_ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function maybeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function buildProfilePhotoReference(storageProvider, storageKey) {
  return `private:${storageProvider}:${storageKey}`;
}

function parseProfilePhotoReference(reference) {
  const raw = String(reference || '').trim();
  const match = raw.match(/^private:(local|s3):(.+)$/);
  if (!match) return null;
  return {
    storageProvider: match[1],
    storageKey: match[2],
  };
}

function profilePhotoMimeTypeFromStorageKey(storageKey) {
  const lower = String(storageKey || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function isJpegBuffer(buffer) {
  return buffer?.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
}

function isPngBuffer(buffer) {
  return buffer?.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}

function isWebpBuffer(buffer) {
  return buffer?.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}

function detectProfilePhotoType(file) {
  const buffer = file?.buffer;
  if (isJpegBuffer(buffer)) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }
  if (isPngBuffer(buffer)) {
    return { mimeType: 'image/png', extension: '.png' };
  }
  if (isWebpBuffer(buffer)) {
    return { mimeType: 'image/webp', extension: '.webp' };
  }
  return null;
}

function validateProfilePhotoFile(file) {
  if (!file || !file.buffer) {
    const error = new Error('Please choose a profile photo to upload.');
    error.statusCode = 400;
    throw error;
  }

  const sizeBytes = Number(file.size || file.buffer.length || 0);
  if (!sizeBytes) {
    const error = new Error('The selected profile photo appears to be empty.');
    error.statusCode = 400;
    throw error;
  }

  if (sizeBytes > PROFILE_PHOTO_MAX_BYTES) {
    const error = new Error('Profile photo must be smaller than 5 MB.');
    error.statusCode = 400;
    throw error;
  }

  const detectedType = detectProfilePhotoType(file);
  const extension = `.${String(file.originalname || '').split('.').pop() || ''}`.toLowerCase();
  if (!detectedType || !PROFILE_PHOTO_ALLOWED_MIME_TYPES.has(detectedType.mimeType) || !PROFILE_PHOTO_ALLOWED_EXTENSIONS.has(extension)) {
    const error = new Error('Please upload a JPG, PNG, or WebP image.');
    error.statusCode = 400;
    throw error;
  }

  return detectedType;
}

function firstNonEmpty(values = []) {
  return values.find((value) => value != null && value !== '' && (!Array.isArray(value) || value.length));
}

function asOptionalDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeEntryArray(value) {
  return maybeJsonArray(value).filter((item) => item && typeof item === 'object');
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
  if (!hasCandidateActivityCreateDelegate()) {
    throw new Error('Prisma candidateActivity delegate is unavailable. Regenerate the Prisma client or update the test mocks.');
  }

  try {
    await createCandidateActivityRecord({
      candidateId,
      type,
      metadata,
      jobId: metadata.jobId || null,
      applicationId: metadata.applicationId || null,
      userId: metadata.userId || null,
    });
    await touchCandidateLastActive(candidateId);
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
  const safeProfile = normalizeCandidateProfileForPresentation(profile);
  const skillEntries = serializeEntryArray(safeProfile.skillEntries);
  const experienceEntries = serializeEntryArray(safeProfile.experienceEntries);
  const educationEntries = serializeEntryArray(safeProfile.educationEntries);
  const certificationEntries = serializeEntryArray(safeProfile.certificationEntries);
  const languageEntries = serializeEntryArray(safeProfile.languageEntries);
  const projectEntries = serializeEntryArray(safeProfile.projectEntries);
  const hasSkillDepth = maybeArray(safeProfile.skills).length >= 3 || skillEntries.length >= 1;
  const hasPreferences = maybeArray(safeProfile.preferredRoles).length > 0
    && maybeArray(safeProfile.preferredLocations).length > 0
    && maybeArray(safeProfile.workplacePreferences).length > 0
    && maybeArray(safeProfile.employmentPreferences).length > 0;
  const hasExperience = experienceEntries.some((entry) => firstNonEmpty([entry.company, entry.title, entry.jobTitle, entry.designation, entry.summary]));
  const hasEducation = educationEntries.some((entry) => firstNonEmpty([entry.degree, entry.institution, entry.fieldOfStudy, entry.year]));
  const hasCertifications = certificationEntries.some((entry) => firstNonEmpty([entry.name, entry.issuingOrganisation]));
  const hasProjectsOrLanguages = projectEntries.some((entry) => firstNonEmpty([entry.projectName, entry.name, entry.summary]))
    || languageEntries.some((entry) => firstNonEmpty([entry.language, entry.name]) && firstNonEmpty([entry.proficiency]));
  const sections = [
    {
      key: 'basic_details',
      label: 'Basic details',
      weight: 15,
      complete: Boolean(safeProfile.fullName && safeProfile.phoneNumber && safeProfile.currentTitle && safeProfile.location),
    },
    {
      key: 'professional_details',
      label: 'Professional details',
      weight: 10,
      complete: Boolean(
        safeProfile.totalExperience > 0
        && (safeProfile.summary || safeProfile.headline || safeProfile.currentEmployer || safeProfile.currentDesignation || safeProfile.employmentStatus),
      ),
    },
    {
      key: 'resume',
      label: 'Resume availability',
      weight: 10,
      complete: Boolean(safeProfile.resumeUrl || safeProfile.latestResumeAssetId),
    },
    {
      key: 'skills',
      label: 'Skills and expertise',
      weight: 15,
      complete: hasSkillDepth,
    },
    {
      key: 'experience',
      label: 'Experience history',
      weight: 10,
      complete: hasExperience,
    },
    {
      key: 'education',
      label: 'Education',
      weight: 8,
      complete: hasEducation,
    },
    {
      key: 'certifications',
      label: 'Certifications',
      weight: 6,
      complete: hasCertifications,
    },
    {
      key: 'preferences',
      label: 'Preferences',
      weight: 10,
      complete: hasPreferences,
    },
    {
      key: 'summary',
      label: 'Professional summary and links',
      weight: 10,
      complete: Boolean(safeProfile.headline && safeProfile.summary && firstNonEmpty([safeProfile.linkedInUrl, safeProfile.portfolioUrl, safeProfile.githubUrl])),
    },
    {
      key: 'projects_languages',
      label: 'Projects and languages',
      weight: 6,
      complete: hasProjectsOrLanguages,
    },
  ];

  return sections;
}

function isCandidateOnboardingComplete(profile) {
  const safeProfile = normalizeCandidateProfileForPresentation(profile);
  const sections = profileCompletionSections(safeProfile);
  const requiredBasics = Boolean(
    safeProfile.fullName
    && safeProfile.phoneNumber
    && safeProfile.location
    && safeProfile.currentTitle
    && maybeArray(safeProfile.skills).length > 0,
  );
  const hasResumeSignal = Boolean(safeProfile.latestResumeAssetId || safeProfile.onboardingSkippedResume);
  return requiredBasics && hasResumeSignal && sections.some((section) => section.key === 'preferences' && section.complete);
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

function buildResumeStatus(profile, latestResumeAsset = null) {
  const asset = latestResumeAsset || profile.latestResumeAsset || null;
  const parsingStatus = asset?.parsingStatus || (profile.latestResumeAssetId ? 'PENDING' : null);

  let label = 'Not uploaded';
  let message = 'Upload a resume to unlock faster profile completion and recruiter-ready metadata.';
  if (parsingStatus === 'PENDING') {
    label = 'Queued for parsing';
    message = 'Your resume is queued for parsing.';
  } else if (parsingStatus === 'PROCESSING') {
    label = 'Parsing resume';
    message = 'Careeriz is extracting and organizing resume details in the background.';
  } else if (parsingStatus === 'COMPLETED') {
    label = 'Parsed successfully';
    message = 'Resume details are available to review and apply to your profile.';
  } else if (parsingStatus === 'PARTIAL') {
    label = 'Needs review';
    message = 'Careeriz extracted limited resume data and skipped low-confidence updates. Review the resume or retry parsing.';
  } else if (parsingStatus === 'FAILED') {
    label = 'Parsing failed';
    message = "We couldn't fully parse this resume. Your uploaded file is safe. You can retry parsing or update your profile manually.";
  }

  return {
    hasResume: Boolean(profile.latestResumeAssetId || asset),
    primaryResumeId: profile.latestResumeAssetId || asset?.id || null,
    filename: asset?.originalFilename || null,
    uploadedAt: asset?.createdAt?.toISOString?.() || asset?.createdAt || null,
    updatedAt: asset?.updatedAt?.toISOString?.() || asset?.updatedAt || null,
    parsingStatus,
    parsingStatusLabel: label,
    parsingStatusMessage: message,
    primaryResume: asset ? {
      id: asset.id,
      filename: asset.originalFilename,
      source: asset.source,
      parsingStatus: asset.parsingStatus,
      parsingStatusLabel: label,
      updatedAt: asset.updatedAt?.toISOString?.() || asset.updatedAt || null,
    } : null,
  };
}

function buildResumeSuggestions(latestResumeAsset = null) {
  const suggestionEntries = latestResumeAsset?.parsedData?.suggestedUpdates || {};
  const items = Object.entries(suggestionEntries).map(([field, suggestion]) => ({
    field,
    currentValue: suggestion?.currentValue ?? null,
    resumeValue: typeof suggestion?.resumeValue === 'string'
      ? sanitizeCandidateDisplayField(field, suggestion.resumeValue)
      : suggestion?.resumeValue ?? null,
    confidence: suggestion?.confidence ?? 0,
  })).filter((item) => item.resumeValue != null);

  return {
    hasSuggestions: items.length > 0,
    assetId: latestResumeAsset?.id || null,
    title: 'We found fresh details from your resume',
    description: 'Review the information we found and update your profile.',
    items,
    reviewedAt: latestResumeAsset?.parsedData?.lastReviewedAt || null,
  };
}

function buildProfileSnapshot(profile, completion, latestResumeAsset = null) {
  const safeProfile = normalizeCandidateProfileForPresentation(profile);
  const resumeStatus = buildResumeStatus(profile, latestResumeAsset);
  return {
    completionPercentage: completion.percentage,
    profileImageUrl: safeProfile.profileImageUrl || null,
    fullName: safeProfile.fullName,
    headline: safeProfile.headline || null,
    currentTitle: safeProfile.currentTitle || null,
    currentEmployer: safeProfile.currentEmployer || null,
    currentDesignation: safeProfile.currentDesignation || null,
    location: safeProfile.location || null,
    totalExperience: safeProfile.totalExperience,
    currentCtcLpa: safeProfile.currentCtcLpa ?? null,
    phoneNumber: safeProfile.phoneNumber || null,
    email: safeProfile.email || null,
    noticePeriodDays: safeProfile.noticePeriodDays ?? null,
    availability: safeProfile.availability || null,
    updatedAt: safeProfile.updatedAt?.toISOString?.() || safeProfile.updatedAt || null,
    resumeStatus,
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
    searchableProfile: profile.searchableProfile,
    phoneVisibleToRecruiters: profile.phoneVisibleToRecruiters,
    salaryVisibleToRecruiters: profile.salaryVisibleToRecruiters,
    resumeVisibleToRecruiters: profile.resumeVisibleToRecruiters,
    notificationPreferences: profile.notificationPreferences || {
      email: {
        applicationUpdates: true,
        interviewUpdates: true,
        offerUpdates: true,
        jobRecommendations: profile.notifyForRecommendations,
        jobAlerts: profile.jobAlertEnabled,
        productAnnouncements: profile.notifyForMarketing,
        securityAlerts: true,
      },
      inApp: {
        applicationUpdates: profile.notifyForApplicationUpdates,
        interviewUpdates: profile.notifyForInterviews,
        offerUpdates: profile.notifyForOffers,
        jobRecommendations: profile.notifyForRecommendations,
        jobAlerts: profile.notifyForSavedJobUpdates,
        productAnnouncements: profile.notifyForMarketing,
        securityAlerts: true,
      },
    },
    accountLifecycleStatus: profile.accountLifecycleStatus,
    accountDeactivationRequestedAt: profile.accountDeactivationRequestedAt?.toISOString?.() || profile.accountDeactivationRequestedAt || null,
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
  const profile = await findCandidateProfileWithLatestResume(candidateId);

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const completion = calculateProfileCompletion(profile);
  const resumeStatus = buildResumeStatus(profile, profile.latestResumeAsset);
  const resumeSuggestions = buildResumeSuggestions(profile.latestResumeAsset);
  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion,
    snapshot: buildProfileSnapshot(profile, completion, profile.latestResumeAsset),
    resumeStatus,
    resumeSuggestions,
  };
}

export async function updateCandidateSelfProfile(candidateId, payload, requestMeta = {}) {
  const updateData = {
    ...payload,
    phoneNumber: payload.phoneNumber || null,
    skills: payload.skills ? normalizeStringArray(payload.skills) : undefined,
    skillEntries: payload.skillEntries !== undefined ? serializeEntryArray(payload.skillEntries) : undefined,
    experienceEntries: payload.experienceEntries !== undefined ? serializeEntryArray(payload.experienceEntries) : undefined,
    educationEntries: payload.educationEntries !== undefined ? serializeEntryArray(payload.educationEntries) : undefined,
    certificationEntries: payload.certificationEntries !== undefined ? serializeEntryArray(payload.certificationEntries) : undefined,
    languageEntries: payload.languageEntries !== undefined ? serializeEntryArray(payload.languageEntries) : undefined,
    projectEntries: payload.projectEntries !== undefined ? serializeEntryArray(payload.projectEntries) : undefined,
    portfolioLinks: payload.portfolioLinks !== undefined ? serializeEntryArray(payload.portfolioLinks) : undefined,
    preferredRoles: payload.preferredRoles ? normalizeStringArray(payload.preferredRoles) : undefined,
    preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
    currentEmployer: payload.currentEmployer || null,
    currentDesignation: payload.currentDesignation || null,
    employmentStatus: payload.employmentStatus || null,
    lastWorkingDate: payload.lastWorkingDate !== undefined ? asOptionalDate(payload.lastWorkingDate) : undefined,
    portfolioUrl: payload.portfolioUrl || null,
    linkedInUrl: payload.linkedInUrl || null,
    githubUrl: payload.githubUrl || null,
    searchableProfile: payload.searchableProfile ?? undefined,
    phoneVisibleToRecruiters: payload.phoneVisibleToRecruiters ?? undefined,
    salaryVisibleToRecruiters: payload.salaryVisibleToRecruiters ?? undefined,
    resumeVisibleToRecruiters: payload.resumeVisibleToRecruiters ?? undefined,
    onboardingCompletedAt: payload.onboardingCompletedAt === null ? null : undefined,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'profileImageUrl')) {
    updateData.profileImageUrl = payload.profileImageUrl || null;
  }

  const profile = await updateCandidateProfileWithLatestResume(candidateId, {
    ...updateData,
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

  await markCandidateIntelligenceStale(candidateId, 'CANDIDATE_PROFILE_UPDATED');

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion: calculateProfileCompletion(profile),
    snapshot: buildProfileSnapshot(profile, calculateProfileCompletion(profile), profile.latestResumeAsset),
    resumeStatus: buildResumeStatus(profile, profile.latestResumeAsset),
    resumeSuggestions: buildResumeSuggestions(profile.latestResumeAsset),
  };
}

export async function uploadCandidateProfilePhoto(candidateId, file, requestMeta = {}) {
  const profile = await findCandidateProfileById(candidateId);
  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const detectedType = validateProfilePhotoFile(file);
  const basename = String(file.originalname || 'profile-photo').replace(/\.[^.]+$/, '') || 'profile-photo';
  const normalizedFile = {
    ...file,
    originalname: `${basename}${detectedType.extension}`,
    mimetype: detectedType.mimeType,
  };

  const stored = await storePrivateFile(normalizedFile, {
    prefix: PROFILE_PHOTO_PREFIX,
    metadata: {
      candidateId,
      kind: 'candidate-profile-photo',
    },
  });

  const nextReference = buildProfilePhotoReference(stored.storageProvider, stored.storageKey);
  const previousReference = parseProfilePhotoReference(profile.profileImageUrl);

  const updated = await updateCandidateProfileWithLatestResume(candidateId, {
    profileImageUrl: nextReference,
  });

  if (previousReference?.storageKey && previousReference.storageKey.startsWith(`${PROFILE_PHOTO_PREFIX}/`) && previousReference.storageKey !== stored.storageKey) {
    await deletePrivateFile(previousReference.storageProvider, previousReference.storageKey);
  }

  await recordCandidateActivity(candidateId, 'PROFILE_UPDATED');
  await markCandidateIntelligenceStale(candidateId, 'CANDIDATE_PROFILE_UPDATED');

  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.profile-photo.upload',
      entityType: 'CandidateProfile',
      entityId: candidateId,
      metadata: { candidateId, storageKey: stored.storageKey },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    }, { bestEffort: true });
  }

  const completion = calculateProfileCompletion(updated);
  return {
    profile: serializeCandidateProfile(updated, { includePrivate: true }),
    completion,
    snapshot: buildProfileSnapshot(updated, completion, updated.latestResumeAsset),
  };
}

export async function removeCandidateProfilePhoto(candidateId, requestMeta = {}) {
  const profile = await findCandidateProfileById(candidateId);
  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const previousReference = parseProfilePhotoReference(profile.profileImageUrl);
  const updated = await updateCandidateProfileWithLatestResume(candidateId, {
    profileImageUrl: null,
  });

  if (previousReference?.storageKey && previousReference.storageKey.startsWith(`${PROFILE_PHOTO_PREFIX}/`)) {
    await deletePrivateFile(previousReference.storageProvider, previousReference.storageKey);
  }

  await recordCandidateActivity(candidateId, 'PROFILE_UPDATED');
  await markCandidateIntelligenceStale(candidateId, 'CANDIDATE_PROFILE_UPDATED');

  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: 'candidate.profile-photo.remove',
      entityType: 'CandidateProfile',
      entityId: candidateId,
      metadata: { candidateId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    }, { bestEffort: true });
  }

  const completion = calculateProfileCompletion(updated);
  return {
    profile: serializeCandidateProfile(updated, { includePrivate: true }),
    completion,
    snapshot: buildProfileSnapshot(updated, completion, updated.latestResumeAsset),
  };
}

export async function getCandidateProfilePhotoFile(candidateId) {
  const profile = await findCandidateProfileById(candidateId);
  if (!profile?.profileImageUrl) {
    const error = new Error('Profile photo not found.');
    error.statusCode = 404;
    throw error;
  }

  const storedReference = parseProfilePhotoReference(profile.profileImageUrl);
  if (!storedReference) {
    const error = new Error('Profile photo is unavailable.');
    error.statusCode = 404;
    throw error;
  }

  const file = await readPrivateFileNodeStream(storedReference.storageProvider, storedReference.storageKey);
  return {
    stream: file.stream,
    contentLength: file.contentLength,
    contentType: profilePhotoMimeTypeFromStorageKey(storedReference.storageKey),
  };
}

export async function updateCandidateSettings(candidateId, payload, requestMeta = {}) {
  const profile = await updateCandidateSettingsProfile(candidateId, {
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
    searchableProfile: payload.searchableProfile,
    phoneVisibleToRecruiters: payload.phoneVisibleToRecruiters,
    salaryVisibleToRecruiters: payload.salaryVisibleToRecruiters,
    resumeVisibleToRecruiters: payload.resumeVisibleToRecruiters,
    notificationPreferences: payload.notificationPreferences ?? undefined,
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

  await markCandidateIntelligenceStale(candidateId, 'CANDIDATE_SETTINGS_UPDATED');

  return {
    settings: buildSettingsResponse(profile),
    completion: calculateProfileCompletion(profile),
  };
}

export async function getCandidateSettings(candidateId) {
  const profile = await findCandidateSettingsProfile(candidateId);

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

  const total = await countSavedJobs(where);
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await findSavedJobs(where, buildSavedJobOrderBy(filters.sort), (page - 1) * pageSize, pageSize);

  return {
    items: rows.map((row) => serializeSavedJob(row, { saved: true })),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function saveJobForCandidate(candidateId, jobId, requestMeta = {}) {
  const job = await findPublicJobWithOrganisation({
    id: jobId,
    ...buildPublicJobWhere(),
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  const savedJob = await upsertSavedJobRecord(candidateId, jobId, {
    organisationId: job.organisationId,
    jobSlugSnapshot: job.slug,
    jobTitleSnapshot: job.title,
    organisationNameSnapshot: job.organisation?.name || 'Careeriz employer',
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
  const savedJob = await findSavedJobByCandidateAndJob(candidateId, jobId);

  if (!savedJob) {
    const error = new Error('Saved job not found.');
    error.statusCode = 404;
    throw error;
  }

  await deleteSavedJobById(savedJob.id);
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
  const job = await findPublicJob({
    id: jobId,
    ...buildPublicJobWhere(),
  });

  if (!job) {
    const error = new Error('Job not found.');
    error.statusCode = 404;
    throw error;
  }

  await upsertCandidateJobViewRecord(
    candidateId,
    jobId,
    {
      source: payload.source || null,
      referrerClassification: payload.referrerClassification || null,
    },
    {
      lastViewedAt: new Date(),
      viewCount: { increment: 1 },
      source: payload.source || undefined,
      referrerClassification: payload.referrerClassification || undefined,
    },
  );

  await recordCandidateActivity(candidateId, 'JOB_VIEWED', { jobId });
  return { recorded: true };
}

export async function listCandidateJobViews(candidateId, filters = {}) {
  const requestedPage = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 8));
  const where = { candidateId };
  const total = await countCandidateJobViews(where);
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await findCandidateJobViews(where, (page - 1) * pageSize, pageSize);

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
  await deleteCandidateJobViews(candidateId);
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

  const profile = await findCandidateProfileWithResumeBuilder(candidateId);

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const completion = calculateProfileCompletion(profile);
  const [savedJobs, appliedJobs, openJobs] = await Promise.all([
    findCandidateSavedJobIds(candidateId),
    findCandidateApplicationJobIds(candidateId),
    findRecommendationOpenJobs(buildPublicJobWhere()),
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

  const total = await countNotifications(where);
  const page = clampPage(total, requestedPage, pageSize);
  const rows = await findNotifications(where, (page - 1) * pageSize, pageSize);

  return {
    items: rows.map((row) => serializeCandidateNotification(row)),
    meta: buildMeta(total, page, pageSize),
  };
}

export async function markCandidateNotificationRead(userId, notificationId) {
  const notification = await findNotificationForRecipient(notificationId, userId);

  if (!notification) {
    const error = new Error('Notification not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await updateNotificationReadAt(notificationId, notification.readAt || new Date());

  return serializeCandidateNotification(updated);
}

export async function markAllCandidateNotificationsRead(userId) {
  await markAllNotificationsReadForUser(userId);

  return { updated: true };
}

function missingRelationTable(error) {
  return error?.code === 'P2021'
    || error?.code === 'P1001'
    || error?.message?.includes('does not exist in the current database')
    || error?.message?.includes("Can't reach database server");
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

async function findManyOrEmpty(query) {
  try {
    return await query();
  } catch (error) {
    if (missingRelationTable(error)) {
      return [];
    }
    throw error;
  }
}

export async function getCandidateDashboard(candidateId, userId) {
  const profile = await findCandidateProfileWithLatestResume(candidateId);

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const completion = calculateProfileCompletion(profile);
  const recentViewsPromise = listCandidateJobViews(candidateId, { page: 1, pageSize: 4 });
  const recommendationPromise = getCandidateRecommendations(candidateId, { excludeSaved: true, page: 1, pageSize: 4 });

  const [savedJobsCount, applicationsCount, savedJobs, applications, unreadNotificationsCount, notifications, interviews, offersCount, activeOffers, recentViews, recommendations, resumes] = await Promise.all([
    countSavedJobs({ candidateId }),
    countApplications({ candidateId }),
    findDashboardSavedJobs(candidateId),
    findDashboardApplications(candidateId),
    countUnreadNotificationsForUser(userId),
    findRecentNotificationsForUser(userId),
    findScheduledInterviewRoundsForCandidate(candidateId),
    countOrZero(() => countCandidateOffers({
      candidateId,
      status: {
        in: ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED'],
      },
    })),
    findManyOrEmpty(() => findCandidateOffers({
      candidateId,
      status: {
        in: ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED', 'EXPIRED', 'WITHDRAWN'],
      },
    }, 4)),
    recentViewsPromise,
    recommendationPromise,
    findManyOrEmpty(() => findCandidateResumeAssets(candidateId, 5)),
  ]);

  const activeApplicationsCount = applications.filter((item) => !['Rejected', 'Withdrawn', 'Selected'].includes(item.statusLabel)).length;
  const interviewApplicationsCount = applications.filter((item) => item.currentStage === 'INTERVIEW_SCHEDULED').length;
  const withdrawnApplicationsCount = applications.filter((item) => item.statusLabel === 'Withdrawn').length;
  const closedApplicationsCount = applications.filter((item) => ['Rejected', 'Selected'].includes(item.statusLabel)).length;

  const latestResumeAsset = resumes[0] || profile.latestResumeAsset || null;
  const resumeStatus = buildResumeStatus(profile, latestResumeAsset);
  const resumeSuggestions = buildResumeSuggestions(latestResumeAsset);

  return {
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    completion,
    snapshot: buildProfileSnapshot(profile, completion, latestResumeAsset),
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
      resumeCount: resumes.length,
      onboardingCompleted: isCandidateOnboardingComplete(profile),
    },
    onboarding: {
      completed: isCandidateOnboardingComplete(profile),
      currentStep: profile.onboardingStep || 1,
      completedAt: profile.onboardingCompletedAt?.toISOString?.() || profile.onboardingCompletedAt || null,
    },
    resumeStatus: {
      ...resumeStatus,
      primaryResume: latestResumeAsset ? {
        id: latestResumeAsset.id,
        filename: latestResumeAsset.originalFilename,
        source: latestResumeAsset.source,
        parsingStatus: latestResumeAsset.parsingStatus,
        parsingStatusLabel: resumeStatus.parsingStatusLabel,
        updatedAt: latestResumeAsset.updatedAt?.toISOString?.() || latestResumeAsset.updatedAt,
      } : null,
    },
    resumeSuggestions,
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
    activeOffers: activeOffers.map((row) => ({
      id: row.id,
      referenceNumber: row.referenceNumber,
      status: row.status,
      currency: row.currency,
      totalCompensation: row.totalCompensation ? Number(row.totalCompensation) : null,
      proposedJoiningDate: row.proposedJoiningDate?.toISOString?.() || row.proposedJoiningDate || null,
      expiryAt: row.expiryAt?.toISOString?.() || row.expiryAt || null,
      job: row.job ? serializePublicJob(row.job) : null,
    })),
    notifications: notifications.map((row) => serializeCandidateNotification(row)),
    recommendations,
    quickActions: [
      { label: 'Complete Profile', href: '/candidate/profile' },
      { label: 'Upload Resume', href: '/candidate/resumes' },
      { label: 'Search Jobs', href: '/candidate/jobs' },
      { label: 'View Applications', href: '/candidate/applications' },
      { label: 'View Interviews', href: '/candidate/interviews' },
      { label: 'View Offers', href: '/candidate/offers' },
      { label: 'Open Resume Builder', href: '/candidate/resume-builder' },
    ],
  };
}

export async function getCandidateOnboardingState(candidateId) {
  const profile = await findCandidateOnboardingProfile(candidateId);

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return {
    completed: isCandidateOnboardingComplete(profile),
    currentStep: profile.onboardingStep || 1,
    completion: calculateProfileCompletion(profile),
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    snapshot: buildProfileSnapshot(profile, calculateProfileCompletion(profile), profile.resumeAssets[0] || null),
    resumeStatus: buildResumeStatus(profile, profile.resumeAssets[0] || null),
    resumeSuggestions: buildResumeSuggestions(profile.resumeAssets[0] || null),
    resumes: profile.resumeAssets.map((resume) => ({
      id: resume.id,
      filename: resume.originalFilename,
      source: resume.source,
      isPrimary: resume.isPrimary,
      status: resume.status,
      parsingStatus: resume.parsingStatus,
      parsingStatusLabel: buildResumeStatus(profile, resume).parsingStatusLabel,
    })),
  };
}

export async function saveCandidateOnboarding(candidateId, payload, requestMeta = {}) {
  const profile = await updateCandidateOnboardingProfile(candidateId, {
    fullName: payload.fullName,
    phoneNumber: payload.phoneNumber || null,
    location: payload.location,
    currentTitle: payload.currentTitle,
    totalExperience: payload.totalExperience,
    skills: payload.primarySkills ? normalizeStringArray(payload.primarySkills) : undefined,
    employmentStatus: payload.employmentStatus || null,
    preferredLocations: payload.preferredLocations ? normalizeStringArray(payload.preferredLocations) : undefined,
    workplacePreferences: payload.workplacePreferences || undefined,
    noticePeriodDays: payload.noticePeriodDays ?? undefined,
    profileVisibility: payload.profileVisibility || undefined,
    searchableProfile: payload.searchableProfile ?? undefined,
    onboardingStep: payload.currentStep || 1,
    onboardingLastSavedAt: new Date(),
    onboardingSkippedResume: payload.resumeStepAction === 'SKIP' ? true : undefined,
  });

  const completed = isCandidateOnboardingComplete(profile);
  if (completed && !profile.onboardingCompletedAt) {
    await markCandidateOnboardingCompleted(candidateId, {
      onboardingCompletedAt: new Date(),
      onboardingStep: 4,
    });
  }

  await recordCandidateActivity(candidateId, 'PROFILE_UPDATED', {
    userId: requestMeta.actorUserId || null,
    onboarding: true,
  });

  if (requestMeta.actorUserId) {
    await recordCandidateAuditLog({
      actorUserId: requestMeta.actorUserId,
      action: completed ? 'candidate.onboarding.complete' : 'candidate.onboarding.save',
      entityType: 'CandidateProfile',
      entityId: candidateId,
      metadata: {
        candidateId,
        completed,
        currentStep: payload.currentStep || 1,
      },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    }, { bestEffort: true });
  }

  await markCandidateIntelligenceStale(candidateId, 'CANDIDATE_ONBOARDING_UPDATED');

  return getCandidateOnboardingState(candidateId);
}

export async function getCandidateInterviewCenter(candidateId) {
  const rounds = await findCandidateInterviewRoundsCenter(candidateId);

  const serialized = rounds.map((round) => ({
    id: round.id,
    roundName: round.roundName,
    interviewType: round.interviewType,
    status: round.meeting?.status || round.status,
    timezone: round.meeting?.timezone || round.timezone,
    meetingMode: round.meeting?.mode || round.meetingMode,
    meetingProvider: round.meeting?.provider || round.calendarProvider || 'CUSTOM',
    providerDisplayName: round.meeting?.providerDisplayName || round.calendarProvider || null,
    meetingLink: round.meeting?.safeJoinUrl || round.meetingLink,
    officeAddress: round.meeting?.officeAddress || round.officeAddress,
    dialInInformation: round.meeting?.dialInInformation || null,
    candidateInstructions: round.meeting?.candidateInstructions || round.candidateInstructions,
    cancelReason: round.cancelReason,
    scheduledStartAt: round.meeting?.scheduledStartUtc?.toISOString?.() || round.scheduledStartAt?.toISOString?.() || round.scheduledStartAt || null,
    scheduledEndAt: round.meeting?.scheduledEndUtc?.toISOString?.() || round.scheduledEndAt?.toISOString?.() || round.scheduledEndAt || null,
    rescheduleCount: round.meeting?.rescheduleCount || round.rescheduleCount || 0,
    lastRescheduledAt: round.meeting?.lastRescheduledAt?.toISOString?.() || round.lastRescheduledAt?.toISOString?.() || round.lastRescheduledAt || null,
    calendarDownloadUrl: `/api/interviews/candidate/rounds/${round.id}/calendar.ics`,
    rescheduleRequests: (round.meeting?.rescheduleRequests || []).map((request) => ({
      id: request.id,
      requestedByType: request.requestedByType,
      status: request.status,
      reasonCode: request.reasonCode,
      reasonText: request.reasonText,
      preferredTimezone: request.preferredTimezone,
      reviewedAt: request.reviewedAt?.toISOString?.() || request.reviewedAt || null,
      createdAt: request.createdAt?.toISOString?.() || request.createdAt || null,
      options: (request.options || []).map((option) => ({
        id: option.id,
        proposedStartUtc: option.proposedStartUtc?.toISOString?.() || option.proposedStartUtc || null,
        proposedEndUtc: option.proposedEndUtc?.toISOString?.() || option.proposedEndUtc || null,
        timezone: option.timezone,
        priority: option.priority,
      })),
    })),
    job: round.interviewProcess?.application?.job ? serializePublicJob(round.interviewProcess.application.job) : null,
    applicationId: round.interviewProcess?.application?.id || null,
    panelMembers: (round.panelMembers || []).map((member) => ({
      id: member.id,
      name: member.user?.email?.split('@')[0] || 'Interviewer',
      isLead: member.isLead,
      isObserver: member.isObserver,
    })),
  }));

  const now = new Date();
  return {
    upcoming: serialized.filter((item) => item.status === 'SCHEDULED' && item.scheduledStartAt && new Date(item.scheduledStartAt) >= now),
    past: serialized.filter((item) => item.status === 'COMPLETED' || (item.scheduledStartAt && new Date(item.scheduledStartAt) < now && item.status !== 'SCHEDULED')),
    cancelled: serialized.filter((item) => item.status === 'CANCELLED'),
    rescheduled: serialized.filter((item) => (item.rescheduleCount || 0) > 0),
  };
}

export async function getCandidateOfferCenter(candidateId) {
  const offers = await findCandidateOffersCenter(candidateId);

  const rows = offers.map((offer) => ({
    id: offer.id,
    referenceNumber: offer.referenceNumber,
    version: offer.version,
    status: offer.status,
    currency: offer.currency,
    totalCompensation: offer.totalCompensation ? Number(offer.totalCompensation) : null,
    proposedJoiningDate: offer.proposedJoiningDate?.toISOString?.() || offer.proposedJoiningDate || null,
    actualJoiningDate: offer.actualJoiningDate?.toISOString?.() || offer.actualJoiningDate || null,
    expiryAt: offer.expiryAt?.toISOString?.() || offer.expiryAt || null,
    updatedAt: offer.updatedAt?.toISOString?.() || offer.updatedAt || null,
    pdfDownloadUrl: `/api/offers/candidate/${offer.id}/pdf`,
    job: offer.job ? serializePublicJob(offer.job) : null,
  }));

  return {
    active: rows.filter((offer) => ['RELEASED', 'VIEWED', 'ACCEPTED', 'JOINING_CONFIRMED', 'DEFERRED'].includes(offer.status)),
    accepted: rows.filter((offer) => ['ACCEPTED', 'JOINING_CONFIRMED', 'JOINED', 'DEFERRED'].includes(offer.status)),
    rejected: rows.filter((offer) => offer.status === 'REJECTED'),
    expired: rows.filter((offer) => offer.status === 'EXPIRED'),
    withdrawn: rows.filter((offer) => offer.status === 'WITHDRAWN'),
    superseded: rows.filter((offer) => offer.status === 'SUPERSEDED'),
  };
}

export async function requestCandidateDataExport(candidateId, userId, requestMeta = {}) {
  const [profile, savedJobs, applications, interviews, offers, resumes, notifications] = await exportCandidateDataQueries(candidateId, userId);

  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  await updateCandidateDataExportTimestamps(candidateId, {
    dataExportRequestedAt: new Date(),
    dataExportCompletedAt: new Date(),
  });

  await recordCandidateAuditLog({
    actorUserId: userId,
    action: 'candidate.data-export.request',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: { candidateId },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  }, { bestEffort: true });

  return {
    exportedAt: new Date().toISOString(),
    profile: serializeCandidateProfile(profile, { includePrivate: true }),
    preferences: buildSettingsResponse(profile),
    skills: serializeEntryArray(profile.skillEntries),
    experience: serializeEntryArray(profile.experienceEntries),
    education: serializeEntryArray(profile.educationEntries),
    certifications: serializeEntryArray(profile.certificationEntries),
    languages: serializeEntryArray(profile.languageEntries),
    projects: serializeEntryArray(profile.projectEntries),
    resumes: resumes.map((resume) => ({
      id: resume.id,
      filename: resume.originalFilename,
      source: resume.source,
      status: resume.status,
      isPrimary: resume.isPrimary,
      parsingStatus: resume.parsingStatus,
      uploadedAt: resume.createdAt?.toISOString?.() || resume.createdAt || null,
      updatedAt: resume.updatedAt?.toISOString?.() || resume.updatedAt || null,
    })),
    savedJobs: savedJobs.map((savedJob) => ({
      id: savedJob.id,
      savedAt: savedJob.createdAt?.toISOString?.() || savedJob.createdAt || null,
      jobId: savedJob.jobId,
      title: savedJob.jobTitleSnapshot,
      organisationName: savedJob.organisationNameSnapshot,
      status: savedJob.job?.status || 'REMOVED',
    })),
    applications: applications.map((application) => ({
      id: application.id,
      publicReference: application.publicReference,
      submittedAt: application.submittedAt?.toISOString?.() || application.submittedAt || null,
      withdrawnAt: application.withdrawnAt?.toISOString?.() || application.withdrawnAt || null,
      withdrawalReason: application.withdrawalReason,
      job: application.job ? { id: application.job.id, title: application.job.title } : null,
      timeline: (application.timeline || []).map((item) => ({
        eventType: item.eventType,
        message: item.message,
        createdAt: item.createdAt?.toISOString?.() || item.createdAt || null,
      })),
    })),
    interviews: interviews.map((round) => ({
      id: round.id,
      roundName: round.roundName,
      status: round.status,
      scheduledStartAt: round.scheduledStartAt?.toISOString?.() || round.scheduledStartAt || null,
      scheduledEndAt: round.scheduledEndAt?.toISOString?.() || round.scheduledEndAt || null,
      applicationId: round.interviewProcess?.application?.id || null,
    })),
    offers: offers.map((offer) => ({
      id: offer.id,
      referenceNumber: offer.referenceNumber,
      status: offer.status,
      version: offer.version,
      currency: offer.currency,
      totalCompensation: offer.totalCompensation ? Number(offer.totalCompensation) : null,
      proposedJoiningDate: offer.proposedJoiningDate?.toISOString?.() || offer.proposedJoiningDate || null,
      actualJoiningDate: offer.actualJoiningDate?.toISOString?.() || offer.actualJoiningDate || null,
      job: offer.job ? { id: offer.job.id, title: offer.job.title } : null,
    })),
    notifications: notifications.map((notification) => serializeCandidateNotification(notification)),
  };
}

export async function requestCandidateAccountDeactivation(candidateId, userId, payload, requestMeta = {}) {
  const profile = await findCandidateProfileById(candidateId);
  if (!profile) {
    const error = new Error('Candidate profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await updateCandidateAccountDeactivation(candidateId, {
    accountLifecycleStatus: 'DEACTIVATION_REQUESTED',
    accountDeactivationRequestedAt: new Date(),
    accountDeactivationReason: payload.reason,
    recommendationEnabled: false,
    jobAlertEnabled: false,
    notifyForMarketing: false,
  });

  await recordCandidateAuditLog({
    actorUserId: userId,
    action: 'candidate.account.deactivation-request',
    entityType: 'CandidateProfile',
    entityId: candidateId,
    metadata: {
      candidateId,
      reason: payload.reason,
    },
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return {
    status: updated.accountLifecycleStatus,
    requestedAt: updated.accountDeactivationRequestedAt?.toISOString?.() || updated.accountDeactivationRequestedAt || null,
  };
}
