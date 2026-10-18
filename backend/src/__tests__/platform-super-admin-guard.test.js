import test from 'node:test';
import assert from 'node:assert/strict';

// Control the super-admin identity BEFORE importing the module (env.js reads
// process.env once at load). No DB is touched by the guard, so this runs
// standalone via `node --test`.
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.JWT_SECRET ||= 'careeriz-test-jwt-secret-32-characters!!';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/careeriz_test';
process.env.PLATFORM_SUPER_ADMIN_EMAIL = 'vinoj@xportisglobal.com';

const { isPlatformSuperAdmin, requirePlatformSuperAdmin } = await import('../middleware/platformAdmin.js');

// Access is bound to the configured EMAIL, not a role - the super admin is also
// an org owner/recruiter (RECRUITER_ADMIN) and must keep that role.
const OWNER = { role: 'RECRUITER_ADMIN', email: 'vinoj@xportisglobal.com', isActive: true };

test('isPlatformSuperAdmin accepts the configured email regardless of role', () => {
  assert.equal(isPlatformSuperAdmin(OWNER), true);
  assert.equal(isPlatformSuperAdmin({ role: 'RECRUITER', email: 'vinoj@xportisglobal.com', isActive: true }), true);
  assert.equal(isPlatformSuperAdmin({ role: 'PLATFORM_ADMIN', email: 'vinoj@xportisglobal.com', isActive: true }), true);
  // case / whitespace are normalized
  assert.equal(isPlatformSuperAdmin({ role: 'RECRUITER_ADMIN', email: '  VINOJ@XportisGlobal.com ', isActive: true }), true);
});

test('isPlatformSuperAdmin denies everyone else', () => {
  assert.equal(isPlatformSuperAdmin({ role: 'PLATFORM_ADMIN', email: 'someone@else.com', isActive: true }), false);
  assert.equal(isPlatformSuperAdmin({ role: 'RECRUITER_ADMIN', email: 'owner@anotherorg.com', isActive: true }), false);
  // right email but deactivated account cannot pass
  assert.equal(isPlatformSuperAdmin({ email: 'vinoj@xportisglobal.com', isActive: false }), false);
  assert.equal(isPlatformSuperAdmin(null), false);
  assert.equal(isPlatformSuperAdmin({}), false);
});

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('requirePlatformSuperAdmin() calls next for the owner', () => {
  const mw = requirePlatformSuperAdmin();
  let called = false;
  const res = fakeRes();
  mw({ user: OWNER }, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, null);
});

test('requirePlatformSuperAdmin() rejects non-owners with 403 and no next', () => {
  const mw = requirePlatformSuperAdmin();
  for (const user of [
    { role: 'PLATFORM_ADMIN', email: 'intruder@else.com', isActive: true },
    { role: 'RECRUITER_ADMIN', email: 'owner@anotherorg.com', isActive: true },
    { email: 'vinoj@xportisglobal.com', isActive: false },
    null,
  ]) {
    let called = false;
    const res = fakeRes();
    mw({ user }, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.success, false);
  }
});
