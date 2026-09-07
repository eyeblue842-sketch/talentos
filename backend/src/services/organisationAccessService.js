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
  return req.headers['x-organisation-id'] || req.query.organisationId || null;
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

// "Usable owner" = role OWNER, membership.status ACTIVE, AND the
// underlying user isActive + accountStatus ACTIVE, all at once. A pending
// invitation is not a membership yet and never counts; a deactivated
// user's membership row can still say role=OWNER/status=ACTIVE and must
// NOT count either - ownership only "usable" if that owner could actually
// log in and use it right now.
export async function countActiveOwners(client, organisationId, excludeMembershipId = null) {
  return client.organisationMembership.count({
    where: {
      organisationId,
      role: 'OWNER',
      status: 'ACTIVE',
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}),
      user: { isActive: true, accountStatus: 'ACTIVE' },
    },
  });
}

/**
 * Guards against a single membership/account-status change leaving an
 * organisation with zero usable owners (see countActiveOwners above).
 * `wasActiveOwner`/`willBeActiveOwner` are supplied by the caller, which
 * already knows both the before- and proposed-after state of the one
 * membership being changed - this only decides whether that specific
 * transition needs the "is anyone else still an owner" check at all, and
 * performs it.
 *
 * MUST be called with the same transaction client (`tx`) the membership/
 * user write itself runs in - not the bare `prisma` singleton - so the
 * count this reads and the write it guards commit atomically. Two
 * concurrent requests each trying to demote the sole owner will not both
 * read "zero remaining" and both proceed: whichever transaction commits
 * first is immediately visible to the other's count once it starts (same
 * read-committed snapshot the rest of this codebase's transactions rely
 * on), so the second transaction's count reflects the first's result and
 * is correctly blocked.
 */
export async function assertOwnershipInvariant(tx, { organisationId, membershipId, wasActiveOwner, willBeActiveOwner }) {
  if (!wasActiveOwner || willBeActiveOwner) return;

  // countActiveOwners() alone is not race-safe: a plain read takes no lock,
  // so two concurrent transactions each demoting a DIFFERENT one of an
  // org's two owners could both count "1 other owner exists" before either
  // commits, and both proceed - leaving zero. Locking the Organisation row
  // first serializes every ownership-affecting transaction for this org
  // (whichever runs its FOR UPDATE first blocks the other until it
  // commits), so the count the second transaction sees always reflects the
  // first transaction's already-committed result.
  await tx.$queryRaw`SELECT id FROM "Organisation" WHERE id = ${organisationId} FOR UPDATE`;

  const remaining = await countActiveOwners(tx, organisationId, membershipId);
  if (remaining === 0) {
    throw buildOrganisationAccessError(
      "Cannot remove the organisation's last active owner. Transfer ownership to another active member first.",
      409,
    );
  }
}
