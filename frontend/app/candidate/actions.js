'use server';

import { revalidatePath } from 'next/cache';
import {
  acceptCandidateOfferResponse,
  clearCandidateRecentJobs,
  getCandidateApplicationWithdrawal,
  rejectCandidateOfferResponse,
  requestCandidateOfferRevisionResponse,
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
  saveCandidateJob,
  unsaveCandidateJob,
  updateCandidateProfile,
  updateCandidateSettings,
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

function collectCommaSeparated(formData, field) {
  return String(formData.get(field) || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectMultiValue(formData, field) {
  return formData.getAll(field).map((item) => String(item)).filter(Boolean);
}

export async function updateCandidateProfileAction(formData) {
  await updateCandidateProfile({
    fullName: String(formData.get('fullName') || ''),
    headline: String(formData.get('headline') || ''),
    currentTitle: String(formData.get('currentTitle') || ''),
    location: String(formData.get('location') || ''),
    totalExperience: Number(formData.get('totalExperience') || 0),
    skills: collectCommaSeparated(formData, 'skills'),
    preferredRoles: collectCommaSeparated(formData, 'preferredRoles'),
    preferredLocations: collectCommaSeparated(formData, 'preferredLocations'),
    workplacePreferences: collectMultiValue(formData, 'workplacePreferences'),
    employmentPreferences: collectMultiValue(formData, 'employmentPreferences'),
    availability: String(formData.get('availability') || ''),
    noticePeriodDays: formData.get('noticePeriodDays') ? Number(formData.get('noticePeriodDays')) : null,
    currentCtcLpa: formData.get('currentCtcLpa') ? Number(formData.get('currentCtcLpa')) : null,
    expectedCtcLpa: formData.get('expectedCtcLpa') ? Number(formData.get('expectedCtcLpa')) : null,
    summary: String(formData.get('summary') || ''),
    profileImageUrl: String(formData.get('profileImageUrl') || ''),
    portfolioUrl: String(formData.get('portfolioUrl') || ''),
    linkedInUrl: String(formData.get('linkedInUrl') || ''),
    githubUrl: String(formData.get('githubUrl') || ''),
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
  });

  revalidatePath('/candidate');
  revalidatePath('/candidate/dashboard');
  revalidatePath('/candidate/settings');
  revalidatePath('/candidate/jobs');
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
