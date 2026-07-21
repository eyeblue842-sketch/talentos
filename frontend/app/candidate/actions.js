'use server';

import { revalidatePath } from 'next/cache';
import {
  acceptCandidateOfferResponse,
  applyCandidateResumeParsedUpdates,
  clearCandidateRecentJobs,
  getCandidateDataExport,
  getCandidateApplicationWithdrawal,
  rejectCandidateOfferResponse,
  requestCandidateAccountDeactivation,
  requestCandidateInterviewReschedule,
  requestCandidateOfferRevisionResponse,
  saveCandidateOnboarding,
  saveResumeBuilderLink,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
  saveCandidateJob,
  unsaveCandidateJob,
  updateCandidateResumeAssetState,
  updateCandidateProfile,
  updateCandidateSettings,
  withdrawCandidateInterviewReschedule,
  withdrawCandidateApplication,
} from '@/lib/api';

function redirectTarget(formData, fallback) {
  return formData.get('redirectTo') || fallback;
}

export async function saveJobAction(formData) {
  const jobId = String(formData.get('jobId') || '');
  if (!jobId) return;
  await saveCandidateJob(jobId);
  const path = String(redirectTarget(formData, '/candidate/jobs'));
  revalidatePath(path);
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/jobs');
  revalidatePath('/candidate/saved-jobs');
}

export async function unsaveJobAction(formData) {
  const jobId = String(formData.get('jobId') || '');
  if (!jobId) return;
  await unsaveCandidateJob(jobId);
  const path = String(redirectTarget(formData, '/candidate/saved-jobs'));
  revalidatePath(path);
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/jobs');
  revalidatePath('/candidate/saved-jobs');
}

export async function markNotificationReadAction(formData) {
  const notificationId = String(formData.get('notificationId') || '');
  if (!notificationId) return;
  await markCandidateNotificationRead(notificationId);
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/notifications');
}

export async function markAllNotificationsReadAction() {
  await markAllCandidateNotificationsRead();
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/notifications');
}

export async function clearRecentJobsAction() {
  await clearCandidateRecentJobs();
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
}

export async function submitCandidateOnboardingAction(previousState, formData) {
  try {
    await saveCandidateOnboarding({
      fullName: String(formData.get('fullName') || ''),
      phoneNumber: String(formData.get('phoneNumber') || ''),
      location: String(formData.get('location') || ''),
      currentTitle: String(formData.get('currentTitle') || ''),
      totalExperience: Number(formData.get('totalExperience') || 0),
      primarySkills: collectCommaSeparated(formData, 'primarySkills'),
      employmentStatus: String(formData.get('employmentStatus') || '') || null,
      preferredLocations: collectCommaSeparated(formData, 'preferredLocations'),
      workplacePreferences: collectMultiValue(formData, 'workplacePreferences'),
      noticePeriodDays: formData.get('noticePeriodDays') ? Number(formData.get('noticePeriodDays')) : null,
      profileVisibility: String(formData.get('profileVisibility') || 'PRIVATE'),
      searchableProfile: formData.get('searchableProfile') === 'on',
      resumeStepAction: String(formData.get('resumeStepAction') || 'UNCHANGED'),
      currentStep: Number(formData.get('currentStep') || 1),
    });
    revalidatePath('/candidate/onboarding');
    revalidatePath('/candidate');
    revalidatePath('/candidate/dashboard');
    revalidatePath('/candidate/profile');
    return {
      status: 'success',
      message: 'Onboarding progress saved.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

function collectCommaSeparated(formData, field) {
  return String(formData.get(field) || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectMultiValue(formData, field) {
  return formData.getAll(field).map((item) => String(item)).filter(Boolean);
}

function parseJsonArrayField(formData, field) {
  const raw = String(formData.get(field) || '').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function updateCandidateProfileAction(formData) {
  await updateCandidateProfile({
    fullName: String(formData.get('fullName') || ''),
    phoneNumber: String(formData.get('phoneNumber') || ''),
    headline: String(formData.get('headline') || ''),
    currentTitle: String(formData.get('currentTitle') || ''),
    currentEmployer: String(formData.get('currentEmployer') || ''),
    currentDesignation: String(formData.get('currentDesignation') || ''),
    location: String(formData.get('location') || ''),
    totalExperience: Number(formData.get('totalExperience') || 0),
    skills: collectCommaSeparated(formData, 'skills'),
    skillEntries: parseJsonArrayField(formData, 'skillEntries'),
    experienceEntries: parseJsonArrayField(formData, 'experienceEntries'),
    educationEntries: parseJsonArrayField(formData, 'educationEntries'),
    certificationEntries: parseJsonArrayField(formData, 'certificationEntries'),
    languageEntries: parseJsonArrayField(formData, 'languageEntries'),
    projectEntries: parseJsonArrayField(formData, 'projectEntries'),
    portfolioLinks: parseJsonArrayField(formData, 'portfolioLinks'),
    preferredRoles: collectCommaSeparated(formData, 'preferredRoles'),
    preferredLocations: collectCommaSeparated(formData, 'preferredLocations'),
    workplacePreferences: collectMultiValue(formData, 'workplacePreferences'),
    employmentPreferences: collectMultiValue(formData, 'employmentPreferences'),
    availability: String(formData.get('availability') || ''),
    employmentStatus: String(formData.get('employmentStatus') || '') || null,
    lastWorkingDate: String(formData.get('lastWorkingDate') || '') || null,
    noticePeriodDays: formData.get('noticePeriodDays') ? Number(formData.get('noticePeriodDays')) : null,
    currentCtcLpa: formData.get('currentCtcLpa') ? Number(formData.get('currentCtcLpa')) : null,
    expectedCtcLpa: formData.get('expectedCtcLpa') ? Number(formData.get('expectedCtcLpa')) : null,
    summary: String(formData.get('summary') || ''),
    profileImageUrl: String(formData.get('profileImageUrl') || ''),
    portfolioUrl: String(formData.get('portfolioUrl') || ''),
    linkedInUrl: String(formData.get('linkedInUrl') || ''),
    githubUrl: String(formData.get('githubUrl') || ''),
    searchableProfile: formData.get('searchableProfile') === 'on',
    phoneVisibleToRecruiters: formData.get('phoneVisibleToRecruiters') === 'on',
    salaryVisibleToRecruiters: formData.get('salaryVisibleToRecruiters') === 'on',
    resumeVisibleToRecruiters: formData.get('resumeVisibleToRecruiters') === 'on',
    profileVisibility: String(formData.get('profileVisibility') || 'PRIVATE'),
  });

  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/profile');
  revalidatePath('/candidate/settings');
}

export async function updateCandidateSettingsAction(formData) {
  await updateCandidateSettings({
    profileVisibility: String(formData.get('profileVisibility') || 'PRIVATE'),
    recommendationEnabled: formData.get('recommendationEnabled') === 'on',
    preferredRoles: collectCommaSeparated(formData, 'preferredRoles'),
    preferredIndustries: collectCommaSeparated(formData, 'preferredIndustries'),
    preferredCompanySizes: collectCommaSeparated(formData, 'preferredCompanySizes'),
    preferredLocations: collectCommaSeparated(formData, 'preferredLocations'),
    willingToRelocate: formData.get('willingToRelocate') === 'on',
    workplacePreferences: collectMultiValue(formData, 'workplacePreferences'),
    employmentPreferences: collectMultiValue(formData, 'employmentPreferences'),
    minExpectedSalary: formData.get('minExpectedSalary') ? Number(formData.get('minExpectedSalary')) : null,
    preferredCurrency: String(formData.get('preferredCurrency') || ''),
    availability: String(formData.get('availability') || ''),
    noticePeriodDays: formData.get('noticePeriodDays') ? Number(formData.get('noticePeriodDays')) : null,
    workAuthorization: String(formData.get('workAuthorization') || ''),
    requiresVisaSponsorship: formData.get('requiresVisaSponsorship') === 'on',
    travelWillingness: String(formData.get('travelWillingness') || ''),
    jobAlertEnabled: formData.get('jobAlertEnabled') === 'on',
    jobAlertFrequency: String(formData.get('jobAlertFrequency') || 'WEEKLY'),
    notifyForSavedJobUpdates: formData.get('notifyForSavedJobUpdates') === 'on',
    notifyForApplicationUpdates: formData.get('notifyForApplicationUpdates') === 'on',
    notifyForRecommendations: formData.get('notifyForRecommendations') === 'on',
    notifyForInterviews: formData.get('notifyForInterviews') === 'on',
    notifyForOffers: formData.get('notifyForOffers') === 'on',
    notifyForProfileReminders: formData.get('notifyForProfileReminders') === 'on',
    notifyForMarketing: formData.get('notifyForMarketing') === 'on',
    searchableProfile: formData.get('searchableProfile') === 'on',
    phoneVisibleToRecruiters: formData.get('phoneVisibleToRecruiters') === 'on',
    salaryVisibleToRecruiters: formData.get('salaryVisibleToRecruiters') === 'on',
    resumeVisibleToRecruiters: formData.get('resumeVisibleToRecruiters') === 'on',
    notificationPreferences: {
      email: {
        applicationUpdates: formData.get('emailApplicationUpdates') === 'on',
        interviewUpdates: formData.get('emailInterviewUpdates') === 'on',
        offerUpdates: formData.get('emailOfferUpdates') === 'on',
        jobRecommendations: formData.get('emailJobRecommendations') === 'on',
        jobAlerts: formData.get('emailJobAlerts') === 'on',
        productAnnouncements: formData.get('emailProductAnnouncements') === 'on',
        securityAlerts: true,
      },
      inApp: {
        applicationUpdates: formData.get('inAppApplicationUpdates') === 'on',
        interviewUpdates: formData.get('inAppInterviewUpdates') === 'on',
        offerUpdates: formData.get('inAppOfferUpdates') === 'on',
        jobRecommendations: formData.get('inAppJobRecommendations') === 'on',
        jobAlerts: formData.get('inAppJobAlerts') === 'on',
        productAnnouncements: formData.get('inAppProductAnnouncements') === 'on',
        securityAlerts: true,
      },
    },
  });

  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/settings');
  revalidatePath('/candidate/jobs');
}

export async function updateResumeAssetStateAction(formData) {
  const assetId = String(formData.get('assetId') || '');
  const action = String(formData.get('actionType') || '');
  if (!assetId || !action) return;
  await updateCandidateResumeAssetState(assetId, action);
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/resumes');
  revalidatePath('/candidate/profile');
}

export async function applyResumeParsedUpdatesAction(formData) {
  const assetId = String(formData.get('assetId') || '');
  if (!assetId) return;
  await applyCandidateResumeParsedUpdates(assetId, {
    acceptAll: formData.get('acceptAll') === 'true',
    fields: formData.getAll('fields').map((value) => String(value)),
  });
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/resumes');
  revalidatePath('/candidate/profile');
}

export async function linkExternalResumeBuilderAction(formData) {
  await saveResumeBuilderLink({
    externalResumeId: String(formData.get('externalResumeId') || '') || null,
    externalResumeUrl: String(formData.get('externalResumeUrl') || '') || null,
    externalResumeVersion: String(formData.get('externalResumeVersion') || '') || null,
  });
  revalidatePath('/candidate/resumes');
  revalidatePath('/candidate/resume-builder');
  revalidatePath('/candidate/dashboard');
}

export async function requestCandidateDataExportAction() {
  return getCandidateDataExport();
}

export async function requestInterviewRescheduleAction(formData) {
  const roundId = String(formData.get('roundId') || '');
  if (!roundId) return;
  const options = [];

  for (let index = 1; index <= 3; index += 1) {
    const start = String(formData.get(`preferredStart${index}`) || '');
    const end = String(formData.get(`preferredEnd${index}`) || '');
    if (!start || !end) continue;
    options.push({
      proposedStartUtc: new Date(start).toISOString(),
      proposedEndUtc: new Date(end).toISOString(),
      timezone: String(formData.get(`preferredTimezone${index}`) || formData.get('preferredTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    });
  }

  if (!options.length) return;

  await requestCandidateInterviewReschedule(roundId, {
    roundId,
    reasonCode: String(formData.get('reasonCode') || 'OTHER'),
    reasonText: String(formData.get('reasonText') || ''),
    preferredTimezone: String(formData.get('preferredTimezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
    options,
  });

  revalidatePath('/candidate/interviews');
  revalidatePath('/candidate/dashboard');
}

export async function withdrawInterviewRescheduleAction(formData) {
  const requestId = String(formData.get('requestId') || '');
  if (!requestId) return;
  await withdrawCandidateInterviewReschedule(requestId);
  revalidatePath('/candidate/interviews');
  revalidatePath('/candidate/dashboard');
}

export async function requestCandidateAccountDeactivationAction(previousState, formData) {
  try {
    await requestCandidateAccountDeactivation({
      reason: String(formData.get('reason') || '').trim(),
    });
    revalidatePath('/candidate/settings');
    return {
      status: 'success',
      message: 'Account deactivation request recorded.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function withdrawCandidateApplicationAction(previousState, formData) {
  try {
    const applicationId = String(formData.get('applicationId') || '');
    if (!applicationId) {
      return {
        status: 'error',
        message: 'Application not found.',
        fieldErrors: {},
      };
    }

    const eligibility = await getCandidateApplicationWithdrawal(applicationId);
    if (!eligibility.canWithdraw) {
      return {
        status: 'error',
        message: 'This application can no longer be withdrawn.',
        fieldErrors: {},
      };
    }

    await withdrawCandidateApplication(applicationId, {
      reason: String(formData.get('reason') || '') || null,
      note: String(formData.get('note') || '') || null,
    });

    revalidatePath('/candidate');
    revalidatePath('/candidate/dashboard');
    revalidatePath('/candidate/applications');
    revalidatePath(`/candidate/applications/${applicationId}`);

    return {
      status: 'success',
      message: 'Application withdrawn successfully.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

function buildActionError(error) {
  return {
    status: 'error',
    message: error.message || 'Unable to save your changes.',
    fieldErrors: error.details?.fieldErrors || {},
  };
}

export async function submitCandidateProfileFormAction(previousState, formData) {
  try {
    await updateCandidateProfileAction(formData);
    return {
      status: 'success',
      message: 'Profile saved successfully.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function submitCandidateSettingsFormAction(previousState, formData) {
  try {
    await updateCandidateSettingsAction(formData);
    return {
      status: 'success',
      message: 'Settings saved successfully.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function acceptCandidateOfferAction(previousState, formData) {
  try {
    const offerId = String(formData.get('offerId') || '');
    await acceptCandidateOfferResponse(offerId, {
      confirmation: true,
      comment: String(formData.get('comment') || '') || null,
    });
    revalidatePath('/candidate');
    revalidatePath('/candidate/dashboard');
    revalidatePath('/candidate/applications');
    revalidatePath('/candidate/offers');
    revalidatePath(`/candidate/offers/${offerId}`);
    return {
      status: 'success',
      message: 'Offer accepted successfully.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function rejectCandidateOfferAction(previousState, formData) {
  try {
    const offerId = String(formData.get('offerId') || '');
    await rejectCandidateOfferResponse(offerId, {
      reason: String(formData.get('reason') || '').trim(),
      comment: String(formData.get('comment') || '') || null,
    });
    revalidatePath('/candidate');
    revalidatePath('/candidate/dashboard');
    revalidatePath('/candidate/applications');
    revalidatePath('/candidate/offers');
    revalidatePath(`/candidate/offers/${offerId}`);
    return {
      status: 'success',
      message: 'Offer response recorded.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function requestCandidateOfferRevisionAction(previousState, formData) {
  try {
    const offerId = String(formData.get('offerId') || '');
    await requestCandidateOfferRevisionResponse(offerId, {
      comment: String(formData.get('comment') || '').trim(),
    });
    revalidatePath('/candidate');
    revalidatePath('/candidate/dashboard');
    revalidatePath('/candidate/applications');
    revalidatePath('/candidate/offers');
    revalidatePath(`/candidate/offers/${offerId}`);
    return {
      status: 'success',
      message: 'Revision request sent successfully.',
      fieldErrors: {},
    };
  } catch (error) {
    return buildActionError(error);
  }
}

export async function acceptCandidateOfferDirectAction(formData) {
  const offerId = String(formData.get('offerId') || '');
  await acceptCandidateOfferResponse(offerId, {
    confirmation: true,
    comment: String(formData.get('comment') || '') || null,
  });
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/applications');
  revalidatePath('/candidate/offers');
  revalidatePath(`/candidate/offers/${offerId}`);
}

export async function rejectCandidateOfferDirectAction(formData) {
  const offerId = String(formData.get('offerId') || '');
  await rejectCandidateOfferResponse(offerId, {
    reason: String(formData.get('reason') || '').trim(),
    comment: String(formData.get('comment') || '') || null,
  });
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/applications');
  revalidatePath('/candidate/offers');
  revalidatePath(`/candidate/offers/${offerId}`);
}

export async function requestCandidateOfferRevisionDirectAction(formData) {
  const offerId = String(formData.get('offerId') || '');
  await requestCandidateOfferRevisionResponse(offerId, {
    comment: String(formData.get('comment') || '').trim(),
  });
  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/applications');
  revalidatePath('/candidate/offers');
  revalidatePath(`/candidate/offers/${offerId}`);
}
