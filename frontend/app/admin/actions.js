'use server';

import { revalidatePath } from 'next/cache';
import {
  archiveAdminOrganisation,
  archiveAdminOrganisationUnit,
  bulkInviteAdminUsers,
  bulkUpdateAdminUsers,
  saveAdminFeatureFlag,
  saveAdminNotificationTemplate,
  saveAdminOrganisationUnit,
  saveAdminRole,
  transferAdminOwnership,
  updateAdminLookups,
  updateAdminOrganisation,
  updateAdminSettings,
  updateAdminUserMembership,
  updateAdminWorkflow,
} from '@/lib/api';

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
    careerPageSettings: parseJson(formData.get('careerPageSettings'), {}),
    emailBranding: parseJson(formData.get('emailBranding'), {}),
  });
  refreshAdmin();
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
