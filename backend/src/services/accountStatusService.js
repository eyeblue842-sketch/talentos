import { recordAuditLog } from './auditLogService.js';

function genericAuthFailure() {
  // Every caller must throw exactly this shape - same message and status
  // code the wrong-password case already uses - so a blocked account is
  // indistinguishable from a wrong password to the client. Never surface a
  // more specific "this account is deactivated" message here.
  const error = new Error('Invalid credentials.');
  error.statusCode = 401;
  return error;
}

/**
 * Every path that mints or persists a token/session (password login, OAuth
 * callback, OAuth handoff-token exchange) MUST call this - and must call it
 * BEFORE issuing anything - immediately after resolving the target user.
 * Blocking downstream (as auth() middleware's isActive/sessionVersion check
 * already does for every authenticated request) is necessary but not
 * sufficient on its own: it stops a deactivated account from *using* a
 * token, but a login/OAuth flow that never checks this would still hand
 * one out in the first place, which is the actual defect this guards
 * against.
 */
export async function assertAccountLoginable(user, context = {}) {
  // Fails CLOSED: only an explicit isActive === true and
  // accountStatus === 'ACTIVE' are loginable. Missing/undefined/null/any
  // unrecognised value is treated as NOT loginable, never defaulted to
  // "probably fine" - a caller that passes a partial user object (a bug,
  // a bad select(), a future refactor) must never accidentally grant
  // access by omission. Every real Prisma row always has both columns
  // populated (schema defaults true/'ACTIVE'), so this is never a false
  // block for a genuine active account; test fixtures must model that
  // real shape rather than this check being loosened for their sake.
  if (user.isActive === true && user.accountStatus === 'ACTIVE') {
    return;
  }

  // Best-effort: a logging failure must never itself change the outcome of
  // an already-decided block, so this never blocks or rethrows.
  await recordAuditLog({
    actorUserId: user.id,
    action: 'auth.login.blocked',
    entityType: 'User',
    entityId: user.id,
    metadata: {
      reason: 'account_inactive',
      accountStatus: user.accountStatus,
      isActive: user.isActive,
      channel: context.channel || 'password',
    },
  }).catch(() => {});

  throw genericAuthFailure();
}
