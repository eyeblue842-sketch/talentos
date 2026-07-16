import { prisma } from '../config/db.js';

const roleOrder = ['VIEWER', 'INTERVIEWER', 'HIRING_MANAGER', 'RECRUITER', 'ADMIN', 'OWNER'];

export function roleAtLeast(role, requiredRole) {
  return roleOrder.indexOf(role) >= roleOrder.indexOf(requiredRole);
}

export function hasAnyOrganisationRole(role, allowedRoles = []) {
  return allowedRoles.includes(role);
}

export function buildOrganisationAccessError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getRequestOrganisationId(req) {
  return req.headers['x-organisation-id'] || req.query.organisationId || req.body?.organisationId || null;
}

export async function getActiveMemberships(userId) {
  return prisma.organisationMembership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      organisation: { status: 'ACTIVE' },
    },
    include: { organisation: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function resolveMembershipForRequest(user, requestedOrganisationId = null) {
  const memberships = await getActiveMemberships(user.id);
  const membership = requestedOrganisationId
    ? memberships.find((item) => item.organisationId === requestedOrganisationId)
    : memberships[0];

  return {
    memberships,
    activeMembership: membership || null,
  };
}

export async function requireOrganisationContext(user, requestedOrganisationId = null) {
  const { memberships, activeMembership } = await resolveMembershipForRequest(user, requestedOrganisationId);

  if (!memberships.length) {
    throw buildOrganisationAccessError('Organisation membership required.', 403);
  }

  if (!activeMembership) {
    throw buildOrganisationAccessError('Organisation not found.', 404);
  }

  return {
    memberships,
    activeMembership,
    organisationId: activeMembership.organisationId,
  };
}

export async function requireOrganisationRole(user, allowedRoles, requestedOrganisationId = null) {
  const context = await requireOrganisationContext(user, requestedOrganisationId);

  if (!hasAnyOrganisationRole(context.activeMembership.role, allowedRoles)) {
    throw buildOrganisationAccessError('Insufficient organisation permissions.', 403);
  }

  return context;
}

export function canManageMembers(role) {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canAccessRecruiterAts(role) {
  return ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'].includes(role);
}

export function canManageRequisitions(role) {
  return ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'].includes(role);
}

export function canApproveRequisitions(role) {
  return role === 'OWNER' || role === 'ADMIN';
}
