import { prisma } from '../config/db.js';
import { buildOrganisationAccessError, requireOrganisationContext } from './organisationAccessService.js';

export const enterprisePermissions = [
  'admin.dashboard.read',
  'organisation.profile.manage',
  'organisation.structure.manage',
  'organisation.settings.manage',
  'organisation.workflow.manage',
  'organisation.audit.read',
  'organisation.analytics.read',
  'organisation.users.read',
  'organisation.users.manage',
  'organisation.users.transfer_ownership',
  'organisation.roles.read',
  'organisation.roles.manage',
  'organisation.notifications.manage',
  'organisation.flags.manage',
  'organisation.lookups.manage',
  'interview.schedule',
  'interview.reschedule',
  'interview.cancel',
  'interview.view',
  'interview.join',
  'interview.manageParticipants',
  'interview.reviewRescheduleRequest',
  'interview.overrideConflict',
  'interview.markNoShow',
  'meetingProvider.manage',
  'meetingProvider.viewStatus',
  'meetingProvider.disconnect',
  'schedulingSettings.manage',
  'schedulingAudit.view',
  'intelligence.resume.read',
  'intelligence.resume.generate',
  'intelligence.match.read',
  'intelligence.match.generate',
  'intelligence.match.override',
  'intelligence.ranking.read',
  'intelligence.ranking.generate',
  'intelligence.match.configuration.manage',
  'intelligence.candidate.read',
  'intelligence.candidate.generate',
  'intelligence.job.generate',
  'intelligence.interview.generate',
  'intelligence.search.read',
  'intelligence.search.execute',
  'intelligence.search.history.read',
  'intelligence.saved_search.read',
  'intelligence.saved_search.manage',
  'intelligence.saved_search.share',
  'intelligence.search.use',
  'intelligence.analytics.use',
  'intelligence.governance.read',
  'intelligence.governance.manage',
  // Full billing (invoices, payment references, purchase history, GSTIN/
  // billing address, credit-adjustment history) is OWNER/ADMIN/platform-
  // admin only - see organisation.billing.summary.read below for what a
  // plain RECRUITER/HIRING_MANAGER may see instead (B2 hardening, section 1).
  'organisation.billing.read',
  'organisation.billing.manage',
  // Minimal, non-financial entitlement awareness (ATS/resume-db active,
  // expiry date, remaining job credits, renewal-required flag only - no
  // GSTIN, address, invoices, payment references, or purchase/adjustment
  // history). Granted to RECRUITER/HIRING_MANAGER below.
  'organisation.billing.summary.read',
];

const defaultRolePermissions = {
  OWNER: enterprisePermissions,
  ADMIN: enterprisePermissions.filter((permission) => permission !== 'organisation.users.transfer_ownership'),
  RECRUITER: [
    'admin.dashboard.read',
    'organisation.analytics.read',
    'organisation.audit.read',
    'organisation.users.read',
    'organisation.roles.read',
    'organisation.billing.summary.read',
    'interview.schedule',
    'interview.reschedule',
    'interview.cancel',
    'interview.view',
    'interview.join',
    'interview.manageParticipants',
    'interview.reviewRescheduleRequest',
    'interview.overrideConflict',
    'interview.markNoShow',
    'meetingProvider.viewStatus',
    'intelligence.resume.read',
    'intelligence.resume.generate',
    'intelligence.match.read',
    'intelligence.match.generate',
    'intelligence.ranking.read',
    'intelligence.candidate.read',
    'intelligence.candidate.generate',
    'intelligence.job.generate',
    'intelligence.interview.generate',
    'intelligence.search.read',
    'intelligence.search.execute',
    'intelligence.search.history.read',
    'intelligence.saved_search.read',
    'intelligence.saved_search.manage',
    'intelligence.search.use',
    'intelligence.analytics.use',
  ],
  HIRING_MANAGER: [
    'admin.dashboard.read',
    'organisation.analytics.read',
    'organisation.users.read',
    'organisation.roles.read',
    'organisation.billing.summary.read',
    'interview.schedule',
    'interview.reschedule',
    'interview.cancel',
    'interview.view',
    'interview.join',
    'interview.manageParticipants',
    'interview.reviewRescheduleRequest',
    'interview.overrideConflict',
    'intelligence.match.read',
    'intelligence.ranking.read',
    'intelligence.candidate.read',
    'intelligence.job.generate',
    'intelligence.interview.generate',
    'intelligence.search.read',
    'intelligence.analytics.use',
  ],
  INTERVIEWER: [
    'admin.dashboard.read',
    'interview.view',
    'interview.join',
    'intelligence.interview.generate',
  ],
  VIEWER: [
    'admin.dashboard.read',
    'organisation.analytics.read',
    'interview.view',
    'intelligence.match.read',
    'intelligence.resume.read',
    'intelligence.candidate.read',
    'intelligence.ranking.read',
    'intelligence.search.read',
  ],
};

function normalizePermissions(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  return [];
}

async function getPlatformOrganisationContext(requestedOrganisationId = null) {
  const organisation = requestedOrganisationId
    ? await prisma.organisation.findFirst({ where: { id: requestedOrganisationId, status: 'ACTIVE' } })
    : await prisma.organisation.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });

  if (!organisation) {
    throw buildOrganisationAccessError('Organisation not found.', 404);
  }

  return {
    memberships: [],
    activeMembership: {
      organisationId: organisation.id,
      role: 'OWNER',
      organisation,
      customRoleDefinition: null,
    },
    organisationId: organisation.id,
    isPlatformAdmin: true,
  };
}

export async function resolveEnterpriseContext(actorUser, requestedOrganisationId = null) {
  // PLATFORM_ADMIN is the opt-in equivalent of the legacy org-agnostic ADMIN
  // bypass, for optional system-wide access. RECRUITER_ADMIN is intentionally
  // excluded here - it is scoped to its own organisation via a real
  // OrganisationMembership, same as any recruiter OWNER.
  if (actorUser.role === 'ADMIN' || actorUser.role === 'PLATFORM_ADMIN') {
    return getPlatformOrganisationContext(requestedOrganisationId);
  }

  const context = await requireOrganisationContext(actorUser, requestedOrganisationId);

  if (context.activeMembership?.customRoleDefinitionId && !context.activeMembership.customRoleDefinition) {
    context.activeMembership = await prisma.organisationMembership.findUnique({
      where: { id: context.activeMembership.id },
      include: { organisation: true, customRoleDefinition: true },
    });
  }

  return {
    ...context,
    isPlatformAdmin: false,
  };
}

export function getPermissionsForMembership(membership) {
  if (!membership) return [];
  if (membership.customRoleDefinition?.permissions) {
    return normalizePermissions(membership.customRoleDefinition.permissions);
  }
  return defaultRolePermissions[membership.role] || [];
}

export async function requireEnterprisePermission(actorUser, permission, requestedOrganisationId = null) {
  const context = await resolveEnterpriseContext(actorUser, requestedOrganisationId);

  if (context.isPlatformAdmin) {
    return {
      ...context,
      permissions: enterprisePermissions,
    };
  }

  const permissions = getPermissionsForMembership(context.activeMembership);
  if (!permissions.includes(permission)) {
    throw buildOrganisationAccessError('Insufficient organisation permissions.', 403);
  }

  return {
    ...context,
    permissions,
  };
}

export function cloneDefaultPermissions(baseRole) {
  return [...(defaultRolePermissions[baseRole] || [])];
}
