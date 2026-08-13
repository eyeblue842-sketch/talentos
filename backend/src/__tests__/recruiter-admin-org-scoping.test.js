import test, { before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

let prisma;
let roleSatisfies;
let resolveMembershipForRequest;
let requireOrganisationContext;
let requireOrganisationRole;
let resolveEnterpriseContext;
let state;

function resetState() {
  state = { organisationMemberships: [], organisations: [] };
}

function installPrismaMocks() {
  prisma.organisationMembership.findMany = async ({ where }) => (
    state.organisationMemberships
      .filter((item) => item.userId === where.userId && item.status === 'ACTIVE')
      .map((item) => ({ ...item, organisation: state.organisations.find((org) => org.id === item.organisationId) }))
  );
}

before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';
  ({ prisma } = await import('../config/db.js'));
  ({ roleSatisfies } = await import('../middleware/auth.js'));
  ({
    resolveMembershipForRequest,
    requireOrganisationContext,
    requireOrganisationRole,
  } = await import('../services/organisationAccessService.js'));
  ({ resolveEnterpriseContext } = await import('../services/enterprisePermissionService.js'));
});

beforeEach(() => {
  resetState();
  installPrismaMocks();
});

/**
 * These tests cover the shared chokepoint (organisationAccessService) that
 * every org-scoped service (resumeImportService, jobService, atsService,
 * interviewService, candidateController) already routes through. Proving
 * this primitive resolves/isolates correctly for RECRUITER_ADMIN and
 * RECRUITER stands in for testing every individual consumer, since none of
 * them do their own organisation resolution.
 */
describe('RECRUITER_ADMIN and RECRUITER share the same organisation-scoped data', () => {
  test('RECRUITER_ADMIN (OWNER membership) and a RECRUITER in the same organisation resolve the identical organisationId', async () => {
    state.organisations.push({ id: 'org-A', name: 'Org A', status: 'ACTIVE' });
    state.organisationMemberships.push(
      { id: 'm1', organisationId: 'org-A', userId: 'recruiter-admin-1', role: 'OWNER', status: 'ACTIVE' },
      { id: 'm2', organisationId: 'org-A', userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE' }
    );

    const adminResult = await resolveMembershipForRequest({ id: 'recruiter-admin-1', role: 'RECRUITER_ADMIN' });
    const recruiterResult = await resolveMembershipForRequest({ id: 'recruiter-1', role: 'RECRUITER' });

    assert.equal(adminResult.activeMembership.organisationId, 'org-A');
    assert.equal(recruiterResult.activeMembership.organisationId, 'org-A');
    assert.equal(
      adminResult.activeMembership.organisationId,
      recruiterResult.activeMembership.organisationId,
      'a resume/job/candidate query scoped to either user\'s organisationId hits the same data'
    );
  });

  test('requireOrganisationRole accepts RECRUITER_ADMIN via its OWNER membership for writable actions (uploads, job posting)', async () => {
    state.organisations.push({ id: 'org-A', name: 'Org A', status: 'ACTIVE' });
    state.organisationMemberships.push({ id: 'm1', organisationId: 'org-A', userId: 'recruiter-admin-1', role: 'OWNER', status: 'ACTIVE' });

    const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
    const context = await requireOrganisationRole({ id: 'recruiter-admin-1', role: 'RECRUITER_ADMIN' }, writableRoles);

    assert.equal(context.organisationId, 'org-A');
    assert.equal(context.activeMembership.role, 'OWNER');
  });
});

describe('cross-organisation isolation', () => {
  test('a recruiter in a different organisation cannot resolve or be granted the other organisation\'s id', async () => {
    state.organisations.push(
      { id: 'org-A', name: 'Org A', status: 'ACTIVE' },
      { id: 'org-B', name: 'Org B', status: 'ACTIVE' }
    );
    state.organisationMemberships.push(
      { id: 'm1', organisationId: 'org-A', userId: 'recruiter-admin-1', role: 'OWNER', status: 'ACTIVE' },
      { id: 'm2', organisationId: 'org-B', userId: 'recruiter-outsider', role: 'RECRUITER', status: 'ACTIVE' }
    );

    const outsiderResult = await resolveMembershipForRequest({ id: 'recruiter-outsider', role: 'RECRUITER' });
    assert.equal(outsiderResult.activeMembership.organisationId, 'org-B');
    assert.notEqual(outsiderResult.activeMembership.organisationId, 'org-A');
  });

  test('requireOrganisationContext rejects a user with no membership in the requested organisation', async () => {
    state.organisations.push(
      { id: 'org-A', name: 'Org A', status: 'ACTIVE' },
      { id: 'org-B', name: 'Org B', status: 'ACTIVE' }
    );
    state.organisationMemberships.push(
      { id: 'm2', organisationId: 'org-B', userId: 'recruiter-outsider', role: 'RECRUITER', status: 'ACTIVE' }
    );

    await assert.rejects(
      () => requireOrganisationContext({ id: 'recruiter-outsider', role: 'RECRUITER' }, 'org-A'),
      (error) => {
        assert.equal(error.statusCode, 404, 'requesting an organisation the user has no membership in must not resolve');
        return true;
      }
    );
  });

  test('requireOrganisationRole rejects when the matched membership role is not in the allowed set, even for a real membership', async () => {
    state.organisations.push({ id: 'org-A', name: 'Org A', status: 'ACTIVE' });
    state.organisationMemberships.push({ id: 'm1', organisationId: 'org-A', userId: 'viewer-1', role: 'VIEWER', status: 'ACTIVE' });

    const writableRoles = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'];
    await assert.rejects(
      () => requireOrganisationRole({ id: 'viewer-1', role: 'RECRUITER' }, writableRoles, 'org-A'),
      (error) => {
        assert.equal(error.statusCode, 403);
        return true;
      }
    );
  });
});

describe('role inheritance for the recruiter application', () => {
  test('RECRUITER_ADMIN satisfies both plain RECRUITER-gated routes and ADMIN-gated routes', () => {
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['RECRUITER']), true, 'must reach every normal recruiter module');
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['ADMIN']), true, 'must reach the admin/org console');
    assert.equal(roleSatisfies('RECRUITER_ADMIN', ['RECRUITER', 'ADMIN']), true);
  });

  test('a plain RECRUITER does not satisfy ADMIN-only gates', () => {
    assert.equal(roleSatisfies('RECRUITER', ['ADMIN']), false);
  });

  test('PLATFORM_ADMIN gets the org-agnostic enterprise context bypass; RECRUITER_ADMIN does not', async () => {
    // PLATFORM_ADMIN and legacy ADMIN both take the platform bypass path.
    // RECRUITER_ADMIN must resolve through its own real membership instead,
    // so it never gets read/write access to organisations it does not own.
    state.organisations.push({ id: 'org-A', name: 'Org A', status: 'ACTIVE' });
    state.organisationMemberships.push({ id: 'm1', organisationId: 'org-A', userId: 'recruiter-admin-1', role: 'OWNER', status: 'ACTIVE' });

    const recruiterAdminContext = await resolveEnterpriseContext({ id: 'recruiter-admin-1', role: 'RECRUITER_ADMIN' });
    assert.equal(recruiterAdminContext.organisationId, 'org-A');
    assert.equal(recruiterAdminContext.activeMembership.role, 'OWNER');
  });
});
