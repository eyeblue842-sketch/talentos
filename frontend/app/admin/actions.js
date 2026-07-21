'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  archiveAdminOrganisation,
  archiveAdminOrganisationUnit,
  beginMeetingProviderConnect,
  bulkInviteAdminUsers,
  disconnectMeetingProvider,
  bulkUpdateAdminUsers,
  saveAdminFeatureFlag,
  saveAdminNotificationTemplate,
  saveAdminOrganisationUnit,
  saveAdminRole,
  transferAdminOwnership,
  resetInitialSetup,
  updateAdminLookups,
  updateAdminOrganisation,
  updateAdminSettings,
  updateAdminUserMembership,
  updateAdminWorkflow,
  validateMeetingProvider,
} from '@/lib/api';
import { ORGANISATION_COOKIE, SESSION_COOKIE } from '@/lib/auth';

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJson(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function refreshAdmin() {
  revalidatePath('/admin');
  revalidatePath('/admin/organisation');
  revalidatePath('/admin/users');
  revalidatePath('/admin/roles');
  revalidatePath('/admin/settings');
  revalidatePath('/admin/workflow');
  revalidatePath('/admin/audit');
  revalidatePath('/admin/notifications');
  revalidatePath('/admin/background-jobs');
  revalidatePath('/admin/analytics');
  revalidatePath('/admin/feature-flags');
  revalidatePath('/admin/lookups');
}

export async function updateAdminOrganisationAction(formData) {
  await updateAdminOrganisation({
    name: String(formData.get('name') || ''),
    slug: String(formData.get('slug') || ''),
    website: String(formData.get('website') || ''),
    logoUrl: String(formData.get('logoUrl') || ''),
    industry: String(formData.get('industry') || ''),
    organisationSize: String(formData.get('organisationSize') || ''),
    headquarters: String(formData.get('headquarters') || ''),
    publicDescription: String(formData.get('publicDescription') || ''),
    publicLocations: parseCsv(formData.get('publicLocations')),
    cultureSummary: String(formData.get('cultureSummary') || ''),
    benefitsSummary: String(formData.get('benefitsSummary') || ''),
    careersEnabled: formData.get('careersEnabled') === 'on',
  });
  refreshAdmin();
}

export async function archiveAdminOrganisationAction(formData) {
  await archiveAdminOrganisation({ restore: formData.get('restore') === 'true' });
  refreshAdmin();
}

export async function saveAdminOrganisationUnitAction(formData) {
  await saveAdminOrganisationUnit({
    id: String(formData.get('id') || '') || undefined,
    type: String(formData.get('type') || ''),
    name: String(formData.get('name') || ''),
    code: String(formData.get('code') || ''),
    description: String(formData.get('description') || ''),
    parentId: String(formData.get('parentId') || '') || null,
    metadata: parseJson(formData.get('metadata'), {}),
  });
  refreshAdmin();
}

export async function archiveAdminOrganisationUnitAction(unitId, restore = false) {
  await archiveAdminOrganisationUnit(unitId, { restore });
  refreshAdmin();
}

export async function updateAdminMembershipAction(formData) {
  await updateAdminUserMembership({
    membershipId: String(formData.get('membershipId') || ''),
    role: String(formData.get('role') || '') || undefined,
    customRoleDefinitionId: String(formData.get('customRoleDefinitionId') || '') || null,
    status: String(formData.get('status') || '') || undefined,
    accountStatus: String(formData.get('accountStatus') || '') || undefined,
  });
  refreshAdmin();
}

export async function bulkInviteAdminUsersAction(formData) {
  const invitations = String(formData.get('invitations') || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email, role = 'RECRUITER'] = line.split(',').map((item) => item.trim());
      return { email, role };
    });
  await bulkInviteAdminUsers({ invitations });
  refreshAdmin();
}

export async function bulkUpdateAdminUsersAction(formData) {
  await bulkUpdateAdminUsers({
    membershipIds: parseCsv(formData.get('membershipIds')),
    role: String(formData.get('role') || '') || undefined,
    status: String(formData.get('status') || '') || undefined,
    accountStatus: String(formData.get('accountStatus') || '') || undefined,
  });
  refreshAdmin();
}

export async function transferAdminOwnershipAction(formData) {
  await transferAdminOwnership({ membershipId: String(formData.get('membershipId') || '') });
  refreshAdmin();
}

export async function saveAdminRoleAction(formData) {
  await saveAdminRole({
    id: String(formData.get('id') || '') || undefined,
    name: String(formData.get('name') || ''),
    slug: String(formData.get('slug') || '') || undefined,
    description: String(formData.get('description') || ''),
    baseRole: String(formData.get('baseRole') || '') || null,
    permissions: parseCsv(formData.get('permissions')),
  });
  refreshAdmin();
}

export async function updateAdminSettingsAction(formData) {
  await updateAdminSettings({
    timezone: String(formData.get('timezone') || ''),
    currency: String(formData.get('currency') || ''),
    language: String(formData.get('language') || ''),
    dateFormat: String(formData.get('dateFormat') || ''),
    employmentTypes: parseCsv(formData.get('employmentTypes')),
    workModes: parseCsv(formData.get('workModes')),
    experienceBands: parseJson(formData.get('experienceBands'), []),
    interviewSchedulingSettings: {
      defaultMeetingProvider: String(formData.get('defaultMeetingProvider') || 'CUSTOM'),
      allowedProviders: formData.getAll('allowedProviders').map((value) => String(value)).filter(Boolean),
      defaultInterviewDuration: Number(formData.get('defaultInterviewDuration') || 60),
      minimumSchedulingNoticeMinutes: Number(formData.get('minimumSchedulingNoticeMinutes') || 0),
      maximumCandidateRequests: Number(formData.get('maximumCandidateRequests') || 3),
      maximumRescheduleCount: Number(formData.get('maximumRescheduleCount') || 10),
      rescheduleCutoffMinutes: Number(formData.get('rescheduleCutoffMinutes') || 30),
      reminderIntervalsMinutes: parseCsv(formData.get('reminderIntervalsMinutes')).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
      includeRecruiterInInvite: formData.get('includeRecruiterInInvite') === 'on',
      includeCoordinatorInInvite: formData.get('includeCoordinatorInInvite') === 'on',
      allowAvailabilityChecks: formData.get('allowAvailabilityChecks') === 'on',
      allowManualCustomLink: formData.get('allowManualCustomLink') === 'on',
      candidateRescheduleEnabled: formData.get('candidateRescheduleEnabled') === 'on',
      interviewerRescheduleEnabled: formData.get('interviewerRescheduleEnabled') === 'on',
      zoomWaitingRoomDefault: formData.get('zoomWaitingRoomDefault') === 'on',
      cancellationReasonRequired: formData.get('cancellationReasonRequired') === 'on',
    },
    careerPageSettings: parseJson(formData.get('careerPageSettings'), {}),
    emailBranding: parseJson(formData.get('emailBranding'), {}),
  });
  refreshAdmin();
}

export async function connectMeetingProviderAction(formData) {
  const provider = String(formData.get('provider') || '');
  if (!provider) return;
  const result = await beginMeetingProviderConnect(provider);
  redirect(result.authorizationUrl);
}

export async function validateMeetingProviderAction(formData) {
  const provider = String(formData.get('provider') || '');
  if (!provider) return;
  await validateMeetingProvider(provider);
  refreshAdmin();
}

export async function disconnectMeetingProviderAction(formData) {
  const provider = String(formData.get('provider') || '');
  if (!provider) return;
  await disconnectMeetingProvider(provider);
  refreshAdmin();
}

export async function resetInitialSetupAction(formData) {
  await resetInitialSetup(String(formData.get('password') || ''));
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ORGANISATION_COOKIE);
  redirect('/setup?reset=1');
}

export async function updateAdminWorkflowAction(formData) {
  await updateAdminWorkflow({
    applicationStages: parseCsv(formData.get('applicationStages')),
    interviewPipeline: parseCsv(formData.get('interviewPipeline')),
    defaultHiringWorkflow: parseJson(formData.get('defaultHiringWorkflow'), {}),
    defaultOfferWorkflow: parseJson(formData.get('defaultOfferWorkflow'), {}),
    interviewTemplates: parseJson(formData.get('interviewTemplates'), []),
    offerTemplates: parseJson(formData.get('offerTemplates'), []),
    defaultNotifications: parseJson(formData.get('defaultNotifications'), {}),
    recruitmentTemplates: parseJson(formData.get('recruitmentTemplates'), []),
  });
  refreshAdmin();
}

export async function saveAdminNotificationTemplateAction(formData) {
  await saveAdminNotificationTemplate({
    id: String(formData.get('id') || '') || undefined,
    key: String(formData.get('key') || ''),
    category: String(formData.get('category') || ''),
    channel: String(formData.get('channel') || ''),
    subject: String(formData.get('subject') || ''),
    body: String(formData.get('body') || ''),
    enabled: formData.get('enabled') === 'on',
  });
  refreshAdmin();
}

export async function saveAdminFeatureFlagAction(formData) {
  await saveAdminFeatureFlag({
    id: String(formData.get('id') || '') || undefined,
    key: String(formData.get('key') || ''),
    description: String(formData.get('description') || ''),
    enabled: formData.get('enabled') === 'on',
  });
  refreshAdmin();
}

export async function updateAdminLookupsAction(formData) {
  await updateAdminLookups({
    skills: parseCsv(formData.get('skills')),
    locations: parseCsv(formData.get('locations')),
    departments: parseCsv(formData.get('departments')),
    employmentTypes: parseCsv(formData.get('employmentTypes')),
    currencies: parseCsv(formData.get('currencies')),
    countries: parseCsv(formData.get('countries')),
    interviewTypes: parseCsv(formData.get('interviewTypes')),
    offerStatuses: parseCsv(formData.get('offerStatuses')),
    workflowStatuses: parseCsv(formData.get('workflowStatuses')),
  });
  refreshAdmin();
}
