'use server';

import { revalidatePath } from 'next/cache';
import {
  markAllCandidateNotificationsRead,
  markCandidateNotificationRead,
  saveCandidateJob,
  unsaveCandidateJob,
  updateCandidateProfile,
  updateCandidateSettings,
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
  revalidatePath('/candidate/jobs');
  revalidatePath('/candidate/saved-jobs');
}

export async function markNotificationReadAction(formData) {
  const notificationId = String(formData.get('notificationId') || '');
  if (!notificationId) return;
  await markCandidateNotificationRead(notificationId);
  revalidatePath('/candidate');
  revalidatePath('/candidate/notifications');
}

export async function markAllNotificationsReadAction() {
  await markAllCandidateNotificationsRead();
  revalidatePath('/candidate');
  revalidatePath('/candidate/notifications');
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
  revalidatePath('/candidate/profile');
  revalidatePath('/candidate/settings');
}

export async function updateCandidateSettingsAction(formData) {
  await updateCandidateSettings({
    profileVisibility: String(formData.get('profileVisibility') || 'PRIVATE'),
    recommendationEnabled: formData.get('recommendationEnabled') === 'on',
    preferredLocations: collectCommaSeparated(formData, 'preferredLocations'),
    workplacePreferences: collectMultiValue(formData, 'workplacePreferences'),
    employmentPreferences: collectMultiValue(formData, 'employmentPreferences'),
    notifyForSavedJobUpdates: formData.get('notifyForSavedJobUpdates') === 'on',
    notifyForRecommendations: formData.get('notifyForRecommendations') === 'on',
    notifyForInterviews: formData.get('notifyForInterviews') === 'on',
  });

  revalidatePath('/candidate');
  revalidatePath('/candidate/settings');
  revalidatePath('/candidate/jobs');
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
