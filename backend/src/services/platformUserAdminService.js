import { prisma } from '../config/db.js';
import { recordAuditLog } from './auditLogService.js';
import { createInvitationRecord } from './organisationInvitationService.js';
import { assertOwnershipInvariant } from './organisationAccessService.js';
import { runSerializableTransaction } from '../utils/serializableTransaction.js';

// ---------------------------------------------------------------------------
// Platform super-admin user / email administration (feature/platform-super-admin
// Phase 4). Cross-tenant: every caller MUST already have passed
// requirePlatformSuperAdmin() at the route layer. These helpers deliberately do
// NOT re-check an org-scoped permission (the super admin is not a member of the
// orgs being managed) - but they DO enforce the same data invariants the
// org-scoped paths enforce, above all the "never leave an organisation without a
// usable owner" rule (assertOwnershipInvariant) and session invalidation on any
// change that affects how/whether a user can log in (sessionVersion bump).
// ---------------------------------------------------------------------------

const ORGANISATION_ROLES = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];
// Intentionally permissive: just enough to reject obvious non-emails before a
// DB write. Real deliverability is proven by the re-verification the change
// forces (emailVerifiedAt is cleared below).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  if (code) error.code = code;
  return error;
}
function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Add a user to an organisation by sending a role-scoped invitation (spec:
// "if want to add email id then also we can add"). Reuses the shared invitation
// core so the token / email / accept flow is identical to the org-scoped path.
export async function platformInviteUser(actorUser, organisationId, { email, role }, requestMeta = {}) {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true } });
  if (!org) throw notFound('Organisation not found.');

  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_RE.test(normalizedEmail)) throw badRequest('A valid email address is required.', 'INVALID_EMAIL');
  if (!ORGANISATION_ROLES.includes(role)) throw badRequest('A valid organisation role is required.', 'INVALID_ROLE');

  return createInvitationRecord(
    { organisationId, invitedByUserId: actorUser.id, email: normalizedEmail, role },
    requestMeta,
  );
}

// Change a user's login email safely (spec: "change the email ... from there").
// Enforces global uniqueness, clears email verification so the new address must
// be re-verified, and bumps sessionVersion so every existing session for that
// user is immediately invalidated and they must sign in again with the new
// address.
export async function platformChangeUserEmail(actorUser, userId, newEmail, reason, requestMeta = {}) {
  const normalizedEmail = normalizeEmail(newEmail);
  if (!EMAIL_RE.test(normalizedEmail)) throw badRequest('A valid email address is required.', 'INVALID_EMAIL');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw notFound('User not found.');
  if (normalizeEmail(user.email) === normalizedEmail) {
    throw badRequest('The new email is the same as the current email.', 'EMAIL_UNCHANGED');
  }

  const clash = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
  if (clash && clash.id !== userId) {
    const error = new Error('That email is already in use by another account.');
    error.statusCode = 409;
    error.code = 'EMAIL_IN_USE';
    throw error;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email: normalizedEmail,
      emailVerifiedAt: null,
      sessionVersion: { increment: 1 },
    },
    select: { id: true, email: true, sessionVersion: true },
  });

  await recordAuditLog({
    actorUserId: actorUser.id,
    action: 'platform.user.email.change',
    entityType: 'User',
    entityId: userId,
    beforeData: { email: user.email },
    afterData: { email: updated.email },
    metadata: { reason, sessionsInvalidated: true, emailReVerificationRequired: true },
    ...requestMeta,
  });

  return { id: updated.id, email: updated.email };
}

// Deactivate or reactivate a user account (spec: "request for deletion of any
// email id"). Deactivation is a safe, reversible soft-delete - never a hard
// delete, which would destroy audit history and orphan references. Blocks any
// deactivation that would leave an organisation this user solely owns without a
// usable owner, and bumps sessionVersion so a deactivated user is signed out
// everywhere at once.
export async function platformSetUserActive(actorUser, userId, active, reason, requestMeta = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      isActive: true,
      accountStatus: true,
      memberships: { where: { role: 'OWNER', status: 'ACTIVE' }, select: { id: true, organisationId: true } },
    },
  });
  if (!user) throw notFound('User not found.');

  const result = await runSerializableTransaction(prisma, async (tx) => {
    if (!active) {
      // The user is an active owner of each org in `memberships`; after
      // deactivation they stop being a *usable* owner everywhere. Guard each
      // such org so we never strand one with zero usable owners.
      for (const membership of user.memberships) {
        await assertOwnershipInvariant(tx, {
          organisationId: membership.organisationId,
          membershipId: membership.id,
          wasActiveOwner: true,
          willBeActiveOwner: false,
        });
      }
    }

    return tx.user.update({
      where: { id: userId },
      data: {
        isActive: active,
        accountStatus: active ? 'ACTIVE' : 'DEACTIVATED',
        sessionVersion: { increment: 1 },
      },
      select: { id: true, email: true, isActive: true, accountStatus: true },
    });
  });

  await recordAuditLog({
    actorUserId: actorUser.id,
    action: active ? 'platform.user.reactivate' : 'platform.user.deactivate',
    entityType: 'User',
    entityId: userId,
    beforeData: { isActive: user.isActive, accountStatus: user.accountStatus },
    afterData: { isActive: result.isActive, accountStatus: result.accountStatus },
    metadata: { reason, sessionsInvalidated: true },
    ...requestMeta,
  });

  return { id: result.id, email: result.email, isActive: result.isActive, accountStatus: result.accountStatus };
}
