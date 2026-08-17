import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS, final publication-bypass closure section 2:
// proves the service-level defense-in-depth assertion on
// createOrganisationInvitation (reachable via two converging routes -
// direct invite and admin bulk-invite) and documents, via a passing test,
// the deliberate decision NOT to gate purchase verification (money already
// captured by that point - see billingRoutes.js's comment).
process.env.EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED = 'true';

let prisma;
let createOrganisationInvitation;
let bulkInviteEnterpriseUsers;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ createOrganisationInvitation } = await import('../services/organisationInvitationService.js'));
  ({ bulkInviteEnterpriseUsers } = await import('../services/adminService.js'));
});

beforeEach(() => {
  state = {
    organisation: { id: 'org-1', type: 'COMPANY', domainVerificationStatus: 'PENDING' },
    memberships: [
      { id: 'm1', organisationId: 'org-1', userId: 'owner-1', status: 'ACTIVE', role: 'OWNER', customRoleDefinitionId: null },
    ],
    users: [],
    invitations: [],
  };

  function withOrganisation(membership) {
    return { ...clone(membership), organisation: clone(state.organisation) };
  }

  prisma.organisationMembership = {
    findMany: async () => state.memberships.map(withOrganisation),
    findUnique: async ({ where }) => {
      const membership = state.memberships.find((m) => m.id === where.id);
      return membership ? { ...withOrganisation(membership), customRoleDefinition: null } : null;
    },
  };
  prisma.user = {
    findUnique: async ({ where }) => state.users.find((u) => u.email === where.email) || null,
  };
  prisma.organisationInvitation = {
    findFirst: async () => null,
    create: async ({ data }) => {
      const invitation = { id: `invite-${state.invitations.length + 1}`, ...data, organisation: state.organisation, invitedByUser: {}, acceptedByUser: null };
      state.invitations.push(invitation);
      return invitation;
    },
  };
  prisma.auditLog = { create: async ({ data }) => ({ id: 'audit-1', createdAt: new Date(), ...data }) };
});

const owner = { id: 'owner-1', role: 'RECRUITER' };

test('createOrganisationInvitation is blocked for a COMPANY/PENDING organisation (service-level defense-in-depth)', async () => {
  await assert.rejects(
    () => createOrganisationInvitation(owner, { email: 'newhire@example.com', role: 'RECRUITER' }, 'org-1'),
    (error) => error.statusCode === 403 && error.code === 'ORGANISATION_DOMAIN_VERIFICATION_REQUIRED',
  );
  assert.equal(state.invitations.length, 0);
});

test('the same block applies through the admin bulk-invite convergence point, not just the direct invite route', async () => {
  const results = await bulkInviteEnterpriseUsers(owner, { invitations: [{ email: 'bulk1@example.com', role: 'RECRUITER' }] }, 'org-1');
  assert.equal(results[0].success, false);
  assert.match(results[0].message, /pending platform verification/i);
  assert.equal(state.invitations.length, 0);
});

test('a VERIFIED COMPANY organisation can still send invitations normally', async () => {
  state.organisation.domainVerificationStatus = 'VERIFIED';
  const invitation = await createOrganisationInvitation(owner, { email: 'newhire@example.com', role: 'RECRUITER' }, 'org-1');
  assert.equal(invitation.email, 'newhire@example.com');
  assert.equal(state.invitations.length, 1);
});
