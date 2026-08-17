import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { serializeOrganisationInvitation } from '../serializers/index.js';
import { requireOrganisationContext, requireOrganisationRole } from './organisationAccessService.js';
import { createNotification } from './notificationService.js';
import { recordAuditLog } from './auditLogService.js';
import { sendOrganisationInvitationEmail } from './emailService.js';
import { assertOrganisationVerifiedForAction } from './organisationVerificationGate.js';

const invitationManagingRoles = ['OWNER', 'ADMIN'];
const invitationTtlMs = 1000 * 60 * 60 * 24 * 7;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildInvitationLookup(token) {
  return prisma.organisationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });
}

async function expireInvitationIfNeeded(invitation) {
  if (!invitation || invitation.status !== 'PENDING') return invitation;
  if (invitation.expiresAt > new Date()) return invitation;

  return prisma.organisationInvitation.update({
    where: { id: invitation.id },
    data: { status: 'EXPIRED' },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });
}

function ensureInvitationUsable(invitation) {
  if (!invitation) {
    const error = new Error('Invitation not found.');
    error.statusCode = 404;
    throw error;
  }

  if (invitation.status === 'REVOKED' || invitation.revokedAt) {
    const error = new Error('This invitation has been revoked.');
    error.statusCode = 410;
    throw error;
  }

  if (invitation.status === 'ACCEPTED' || invitation.acceptedAt) {
    const error = new Error('This invitation has already been used.');
    error.statusCode = 410;
    throw error;
  }

  if (invitation.status === 'EXPIRED' || invitation.expiresAt <= new Date()) {
    const error = new Error('This invitation has expired.');
    error.statusCode = 410;
    throw error;
  }
}

async function getInvitationOr404(context, invitationId) {
  const invitation = await prisma.organisationInvitation.findFirst({
    where: { id: invitationId, organisationId: context.organisationId },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });

  if (!invitation) {
    const error = new Error('Invitation not found.');
    error.statusCode = 404;
    throw error;
  }

  return expireInvitationIfNeeded(invitation);
}

async function ensureNoDuplicateActiveInvitation(organisationId, email) {
  const invitation = await prisma.organisationInvitation.findFirst({
    where: {
      organisationId,
      email,
      status: 'PENDING',
    },
  });

  if (!invitation) return;
  if (invitation.expiresAt <= new Date()) {
    await prisma.organisationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  const error = new Error('An active invitation already exists for this email.');
  error.statusCode = 409;
  throw error;
}

async function sendInvitationEmail(invitation, rawToken) {
  const invitationUrl = new URL('/auth/invitations/accept', env.frontendUrl);
  invitationUrl.searchParams.set('token', rawToken);
  await sendOrganisationInvitationEmail({
    to: invitation.email,
    organisationName: invitation.organisation.name,
    role: invitation.role,
    invitationUrl: invitationUrl.toString(),
    expiresAt: invitation.expiresAt,
  });
}

export async function listOrganisationInvitations(actorUser, organisationId = null) {
  const context = await requireOrganisationRole(actorUser, invitationManagingRoles, organisationId);
  const rows = await prisma.organisationInvitation.findMany({
    where: { organisationId: context.organisationId },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const normalized = await Promise.all(rows.map(expireInvitationIfNeeded));
  return normalized.map(serializeOrganisationInvitation);
}

export async function createOrganisationInvitation(actorUser, payload, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, invitationManagingRoles, organisationId);
  // Final publication-bypass closure section 2: this function has two
  // converging entry points (the direct /organisations/invitations route
  // and adminService.bulkInviteEnterpriseUsers via the org-scoped admin
  // console) - both already carry route-level requireVerifiedOrganisation(),
  // but the assertion is repeated here too so "inviting additional
  // recruiter members" stays closed even if a future route forgets the
  // middleware.
  assertOrganisationVerifiedForAction(context.activeMembership.organisation, context.organisationId);
  const email = normalizeEmail(payload.email);

  const existingMembership = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { organisationId: context.organisationId, status: 'ACTIVE' },
      },
    },
  });

  if (existingMembership?.memberships?.length) {
    const error = new Error('This user is already an active member of the organisation.');
    error.statusCode = 409;
    throw error;
  }

  await ensureNoDuplicateActiveInvitation(context.organisationId, email);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const invitation = await prisma.organisationInvitation.create({
    data: {
      organisationId: context.organisationId,
      email,
      role: payload.role,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + invitationTtlMs),
      invitedByUserId: actorUser.id,
    },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });

  await Promise.all([
    sendInvitationEmail(invitation, rawToken),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.invitation.create',
      entityType: 'OrganisationInvitation',
      entityId: invitation.id,
      afterData: { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
      ...requestMeta,
    }),
  ]);

  return serializeOrganisationInvitation(invitation);
}

export async function resendOrganisationInvitation(actorUser, invitationId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, invitationManagingRoles, organisationId);
  const existing = await getInvitationOr404(context, invitationId);
  ensureInvitationUsable(existing);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const updated = await prisma.organisationInvitation.update({
    where: { id: invitationId },
    data: {
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + invitationTtlMs),
      updatedAt: new Date(),
    },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });

  await Promise.all([
    sendInvitationEmail(updated, rawToken),
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.invitation.resend',
      entityType: 'OrganisationInvitation',
      entityId: invitationId,
      beforeData: { expiresAt: existing.expiresAt },
      afterData: { expiresAt: updated.expiresAt },
      ...requestMeta,
    }),
  ]);

  return serializeOrganisationInvitation(updated);
}

export async function revokeOrganisationInvitation(actorUser, invitationId, organisationId = null, requestMeta = {}) {
  const context = await requireOrganisationRole(actorUser, invitationManagingRoles, organisationId);
  const existing = await getInvitationOr404(context, invitationId);
  ensureInvitationUsable(existing);

  const updated = await prisma.organisationInvitation.update({
    where: { id: invitationId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
    include: {
      organisation: true,
      invitedByUser: true,
      acceptedByUser: true,
    },
  });

  await Promise.all([
    recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.invitation.revoke',
      entityType: 'OrganisationInvitation',
      entityId: invitationId,
      beforeData: { status: existing.status },
      afterData: { status: updated.status, revokedAt: updated.revokedAt },
      ...requestMeta,
    }),
    existing.invitedByUserId !== actorUser.id
      ? createNotification({
          organisationId: context.organisationId,
          recipientUserId: existing.invitedByUserId,
          type: 'MEMBERSHIP',
          title: 'Invitation revoked',
          message: `${existing.email} no longer has a pending organisation invitation.`,
          entityType: 'OrganisationInvitation',
          entityId: existing.id,
        })
      : Promise.resolve(),
  ]);

  return serializeOrganisationInvitation(updated);
}

export async function getInvitationByToken(token) {
  const invitation = await buildInvitationLookup(token);
  const normalized = await expireInvitationIfNeeded(invitation);
  ensureInvitationUsable(normalized);
  return serializeOrganisationInvitation(normalized);
}

export async function acceptOrganisationInvitation(actorUser, token, requestMeta = {}) {
  if (actorUser.role !== 'RECRUITER') {
    const error = new Error('Only recruiter accounts can accept organisation invitations.');
    error.statusCode = 403;
    throw error;
  }

  const invitation = await expireInvitationIfNeeded(await buildInvitationLookup(token));
  ensureInvitationUsable(invitation);

  if (normalizeEmail(actorUser.email) !== invitation.email) {
    const error = new Error('This invitation does not match the signed-in account.');
    error.statusCode = 403;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingMembership = await tx.organisationMembership.findFirst({
      where: {
        organisationId: invitation.organisationId,
        userId: actorUser.id,
        status: 'ACTIVE',
      },
    });

    if (existingMembership) {
      const consumed = await tx.organisationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedByUserId: actorUser.id,
          acceptedAt: new Date(),
        },
        include: {
          organisation: true,
          invitedByUser: true,
          acceptedByUser: true,
        },
      });
      return { membership: existingMembership, invitation: consumed, duplicate: true };
    }

    const membership = await tx.organisationMembership.create({
      data: {
        organisationId: invitation.organisationId,
        userId: actorUser.id,
        role: invitation.role,
        status: 'ACTIVE',
        invitedById: invitation.invitedByUserId,
      },
    });

    const recruiterProfile = await tx.recruiterProfile.findUnique({
      where: { userId: actorUser.id },
    });

    if (recruiterProfile && !recruiterProfile.organisationId) {
      await tx.recruiterProfile.update({
        where: { userId: actorUser.id },
        data: { organisationId: invitation.organisationId },
      });
    }

    const consumed = await tx.organisationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedByUserId: actorUser.id,
        acceptedAt: new Date(),
      },
      include: {
        organisation: true,
        invitedByUser: true,
        acceptedByUser: true,
      },
    });

    return { membership, invitation: consumed, duplicate: false };
  });

  await Promise.all([
    createNotification({
      organisationId: invitation.organisationId,
      recipientUserId: invitation.invitedByUserId,
      type: 'MEMBERSHIP',
      title: 'Invitation accepted',
      message: `${actorUser.email} joined ${invitation.organisation.name} as ${invitation.role}.`,
      entityType: 'OrganisationInvitation',
      entityId: invitation.id,
    }),
    recordAuditLog({
      organisationId: invitation.organisationId,
      actorUserId: actorUser.id,
      action: 'organisation.invitation.accept',
      entityType: 'OrganisationInvitation',
      entityId: invitation.id,
      afterData: { role: invitation.role, membershipId: result.membership.id, duplicate: result.duplicate },
      ...requestMeta,
    }),
  ]);

  const { memberships, activeMembership } = await requireOrganisationContext(
    {
      ...actorUser,
      activeMembership: { organisationId: invitation.organisationId, role: invitation.role },
    },
    invitation.organisationId,
  );

  return {
    invitation: serializeOrganisationInvitation(result.invitation),
    membership: {
      organisationId: invitation.organisationId,
      role: invitation.role,
    },
    membershipsCount: memberships.length,
    activeOrganisationId: activeMembership.organisationId,
  };
}
