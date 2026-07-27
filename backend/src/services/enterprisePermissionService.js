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
  'intelligence.candidate.read',
  'intelligence.candidate.generate',
  'intelligence.job.generate',
  'intelligence.interview.generate',
  'intelligence.search.use',
  'intelligence.analytics.use',
  'intelligence.governance.read',
  'intelligence.governance.manage',
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
    'intelligence.candidate.read',
    'intelligence.candidate.generate',
    'intelligence.job.generate',
    'intelligence.interview.generate',
    'intelligence.search.use',
    'intelligence.analytics.use',
  ],
  HIRING_MANAGER: [
    'admin.dashboard.read',
    'organisation.analytics.read',
    'organisation.users.read',
    'organisation.roles.read',
    'interview.schedule',
    'interview.reschedule',
    'interview.cancel',
    'interview.view',
    'interview.join',
    'interview.manageParticipants',
    'interview.reviewRescheduleRequest',
    'interview.overrideConflict',
    'intelligence.match.read',
    'intelligence.candidate.read',
    'intelligence.job.generate',
    'intelligence.interview.generate',
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
  if (actorUser.role === 'ADMIN') {
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
