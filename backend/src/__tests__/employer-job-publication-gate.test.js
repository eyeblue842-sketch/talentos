import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// CAREERIZ EMPLOYER ACCESS, final publication-bypass closure section 1:
// proves the domain-verification gate is enforced at the converged
// jobService.activateJobInTransaction boundary - covering createJob(OPEN),
// updateJob/updateJobStatus (including reopening a CLOSED job), and that a
// rejected publish rolls back completely and consumes no credit - not just
// at the one dedicated status-change route. Enforcement forced on for this
// process, mirroring billing-job-publish-rollout-enabled.test.js's pattern.
process.env.EMPLOYER_ORGANISATION_VERIFICATION_ENFORCEMENT_ENABLED = 'true';
// Also force billing-credit enforcement on for the one test below that
// proves the interaction between the two independent kill-switches: a
// COMPANY/PENDING rejection must happen BEFORE any credit check/consumption
// even when billing enforcement is simultaneously on.
process.env.BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED = 'true';

let prisma;
let createJob;
let updateJob;
let updateJobStatus;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actor(id) {
  return { id, role: 'RECRUITER' };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ createJob, updateJob, updateJobStatus } = await import('../services/jobService.js'));
});

function jobPayload(overrides = {}) {
  return {
    title: 'Backend Engineer',
    description: 'Build APIs',
    skillsRequired: ['Node.js'],
    experienceMin: 3,
    experienceMax: 6,
    location: 'Remote',
    ...overrides,
  };
}

beforeEach(() => {
  state = {
    organisation: { id: 'org-1', type: 'COMPANY', domainVerificationStatus: 'PENDING' },
    memberships: [
      { id: 'm1', organisationId: 'org-1', userId: 'recruiter-1', status: 'ACTIVE', role: 'RECRUITER', user: { id: 'recruiter-1' } },
    ],
    jobs: [],
    auditLogs: [],
    ledger: [],
    creditBalance: 5,
  };

  function withOrganisation(membership) {
    return { ...clone(membership), organisation: clone(state.organisation) };
  }

  prisma.organisationMembership = {
    findMany: async () => state.memberships.filter((m) => m.status === 'ACTIVE').map(withOrganisation),
    findFirst: async ({ where }) => {
      const membership = state.memberships.find((m) => m.organisationId === where.organisationId && m.userId === where.userId && where.role.in.includes(m.role));
      return membership ? withOrganisation(membership) : null;
    },
  };
  prisma.jobRequisition = { findFirst: async () => null };
  prisma.job = {
    create: async ({ data }) => {
      const job = { id: `job-${state.jobs.length + 1}`, updatedAt: new Date(), ...data };
      state.jobs.push(job);
      return clone(job);
    },
    update: async ({ where, data }) => {
      const job = state.jobs.find((item) => item.id === where.id);
      Object.assign(job, data, { updatedAt: new Date() });
      return clone(job);
    },
    findFirst: async ({ where }) => clone(state.jobs.find((item) => item.id === where.id && item.organisationId === where.organisationId) || null),
    findUnique: async () => null,
  };
  prisma.auditLog = { create: async ({ data }) => { state.auditLogs.push(data); return { id: `audit-${state.auditLogs.length}`, ...data }; } };
  prisma.$transaction = async (callback) => {
    const snapshot = clone({ jobs: state.jobs, ledger: state.ledger, auditLogs: state.auditLogs, creditBalance: state.creditBalance });
    try {
      return await callback(prisma);
    } catch (error) {
      state.jobs = snapshot.jobs;
      state.ledger = snapshot.ledger;
      state.auditLogs = snapshot.auditLogs;
      state.creditBalance = snapshot.creditBalance;
      throw error;
    }
  };
  prisma.$queryRaw = async () => [{ balance: state.creditBalance }];
  prisma.jobPostingCreditLedger = {
    create: async ({ data }) => {
      state.ledger.push(data);
      state.creditBalance += data.amount;
      return { id: `ledger-${state.ledger.length}`, ...data };
    },
  };
});

function assertRejectedCleanly(error) {
  return error.statusCode === 403 && error.code === 'ORGANISATION_DOMAIN_VERIFICATION_REQUIRED';
}

test('COMPANY/PENDING cannot create a job directly as OPEN', async () => {
  await assert.rejects(
    () => createJob(actor('recruiter-1'), jobPayload({ status: 'OPEN' }), 'org-1'),
    assertRejectedCleanly,
  );
  assert.equal(state.jobs.length, 0, 'no job row - not even a DRAFT - should exist after a rolled-back create-as-OPEN attempt');
  assert.equal(state.ledger.length, 0, 'no credit consumed on rejection');
});

test('COMPANY/PENDING cannot edit a draft into OPEN via the general update payload (not just the dedicated status route)', async () => {
  const draft = await createJob(actor('recruiter-1'), jobPayload({ title: 'Data Analyst' }), 'org-1');
  assert.equal(draft.status, 'DRAFT');

  await assert.rejects(
    () => updateJob(draft.id, actor('recruiter-1'), jobPayload({ title: 'Data Analyst - CHANGED', status: 'OPEN' }), 'org-1'),
    assertRejectedCleanly,
  );

  const reFetched = state.jobs.find((item) => item.id === draft.id);
  assert.equal(reFetched.status, 'DRAFT', 'status must not change on a rolled-back publish attempt');
  assert.equal(reFetched.title, 'Data Analyst', 'other field edits must also roll back atomically');
  assert.equal(state.ledger.length, 0, 'no credit consumed on rejection');
});

test('COMPANY/PENDING cannot publish via the dedicated status-change path (updateJobStatus)', async () => {
  const draft = await createJob(actor('recruiter-1'), jobPayload({ title: 'QA Engineer' }), 'org-1');

  await assert.rejects(
    () => updateJobStatus(draft.id, actor('recruiter-1'), 'OPEN', 'org-1'),
    assertRejectedCleanly,
  );

  assert.equal(state.jobs.find((item) => item.id === draft.id).status, 'DRAFT');
  assert.equal(state.ledger.length, 0);
});

test('COMPANY/PENDING cannot reopen a CLOSED job', async () => {
  // Seed a job directly as already CLOSED (simulating one created before
  // this organisation's domain was ever PENDING, or auto-closed earlier).
  state.jobs.push({
    id: 'job-closed-1', organisationId: 'org-1', status: 'CLOSED', title: 'Old Role',
    recruiterId: 'recruiter-1', description: 'x', skillsRequired: [], experienceMin: 1, experienceMax: 2, location: 'Remote',
  });

  await assert.rejects(
    () => updateJobStatus('job-closed-1', actor('recruiter-1'), 'OPEN', 'org-1'),
    assertRejectedCleanly,
  );

  assert.equal(state.jobs.find((item) => item.id === 'job-closed-1').status, 'CLOSED');
  assert.equal(state.ledger.length, 0);
});

test('COMPANY/VERIFIED can publish normally and still consumes exactly one credit (both kill-switches on)', async () => {
  state.organisation.domainVerificationStatus = 'VERIFIED';
  const job = await createJob(actor('recruiter-1'), jobPayload({ status: 'OPEN' }), 'org-1');
  assert.equal(job.status, 'OPEN');
  assert.ok(job.activatedAt);
  assert.equal(state.ledger.length, 1);
});

test('a COMPANY/PENDING rejection happens before any credit check - no ledger row, even with billing enforcement also on', async () => {
  state.creditBalance = 5;
  await assert.rejects(
    () => createJob(actor('recruiter-1'), jobPayload({ status: 'OPEN' }), 'org-1'),
    assertRejectedCleanly,
  );
  assert.equal(state.ledger.length, 0);
  assert.equal(state.creditBalance, 5, 'credit balance must be completely untouched by a rejected publish');
});

test('CONSULTANCY can publish normally regardless of domainVerificationStatus', async () => {
  state.organisation = { id: 'org-1', type: 'CONSULTANCY', domainVerificationStatus: 'NOT_APPLICABLE' };
  const job = await createJob(actor('recruiter-1'), jobPayload({ status: 'OPEN' }), 'org-1');
  assert.equal(job.status, 'OPEN');
});

test('a legacy (type=null) organisation can publish normally - never locked out by this gate', async () => {
  state.organisation = { id: 'org-1', type: null, domainVerificationStatus: 'NOT_APPLICABLE' };
  const job = await createJob(actor('recruiter-1'), jobPayload({ status: 'OPEN' }), 'org-1');
  assert.equal(job.status, 'OPEN');
});

test('draft creation and draft editing remain available to a COMPANY/PENDING organisation - only activation is blocked', async () => {
  const draft = await createJob(actor('recruiter-1'), jobPayload({ title: 'Draft Role' }), 'org-1');
  assert.equal(draft.status, 'DRAFT');

  const edited = await updateJob(draft.id, actor('recruiter-1'), jobPayload({ title: 'Draft Role Edited' }), 'org-1');
  assert.equal(edited.status, 'DRAFT');
  assert.equal(edited.title, 'Draft Role Edited');
});
