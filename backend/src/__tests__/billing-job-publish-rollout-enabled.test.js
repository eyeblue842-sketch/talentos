import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Enforcement forced on for this process (see enabled/disabled split
// rationale in billing-entitlement-enforcement-enabled.test.js). Proves
// job publishing genuinely requires and consumes a job-posting credit once
// enforcement is on, converged into the same transaction as job creation/
// field updates (section 10 / B1 hardening section 4).
process.env.BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED = 'true';

let prisma;
let createJob;
let updateJob;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function actor(id) {
  return { id, role: 'RECRUITER' };
}

before(async () => {
  ({ prisma } = await import('../config/db.js'));
  ({ createJob, updateJob } = await import('../services/jobService.js'));
});

beforeEach(() => {
  state = {
    memberships: [
      { id: 'm1', organisationId: 'org-1', userId: 'recruiter-1', status: 'ACTIVE', role: 'RECRUITER', user: { id: 'recruiter-1' } },
    ],
    jobs: [],
    auditLogs: [],
    ledger: [],
    creditBalance: 0,
  };

  prisma.organisationMembership = {
    findMany: async () => state.memberships.filter((m) => m.status === 'ACTIVE').map(clone),
    findFirst: async ({ where }) => clone(state.memberships.find((m) => m.organisationId === where.organisationId && m.userId === where.userId && where.role.in.includes(m.role)) || null),
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
  // Snapshot/restore around the callback so a thrown error genuinely rolls
  // back every mutation made during the attempt (job creation, ledger
  // writes, audit log) - a plain `callback(prisma)` passthrough would let
  // the mock's array pushes survive a thrown error, which would make the
  // atomicity assertions below false positives.
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

test('createJob with status OPEN is blocked with JOB_POSTING_QUOTA_EXCEEDED when the organisation has zero credits, and nothing is created', async () => {
  await assert.rejects(
    () => createJob(actor('recruiter-1'), {
      title: 'Backend Engineer', description: 'Build APIs', skillsRequired: ['Node.js'],
      experienceMin: 3, experienceMax: 6, location: 'Remote', status: 'OPEN',
    }, 'org-1'),
    (error) => error.code === 'JOB_POSTING_QUOTA_EXCEEDED' && error.statusCode === 402,
  );
  assert.equal(state.jobs.length, 0, 'no job should exist after a rolled-back quota failure');
  assert.equal(state.ledger.length, 0);
});

test('createJob with status OPEN succeeds and consumes exactly one credit when one is available', async () => {
  state.creditBalance = 1;

  const job = await createJob(actor('recruiter-1'), {
    title: 'Backend Engineer', description: 'Build APIs', skillsRequired: ['Node.js'],
    experienceMin: 3, experienceMax: 6, location: 'Remote', status: 'OPEN',
  }, 'org-1');

  assert.equal(job.status, 'OPEN');
  assert.ok(job.activatedAt);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.ledger[0].entryType, 'CONSUME');
  assert.equal(state.ledger[0].amount, -1);
  assert.equal(state.creditBalance, 0);
});

test('updateJob DRAFT -> OPEN is blocked with JOB_POSTING_QUOTA_EXCEEDED and does not apply any field changes when no credit is available', async () => {
  state.creditBalance = 1;
  const created = await createJob(actor('recruiter-1'), {
    title: 'Product Designer', description: 'Own UI design', skillsRequired: ['Figma'],
    experienceMin: 3, experienceMax: 6, location: 'Remote', status: 'OPEN',
  }, 'org-1');
  assert.equal(state.creditBalance, 0);

  const secondDraft = await createJob(actor('recruiter-1'), {
    title: 'Data Analyst', description: 'Own analytics', skillsRequired: ['SQL'],
    experienceMin: 2, experienceMax: 5, location: 'Remote',
  }, 'org-1');
  assert.equal(secondDraft.status, 'DRAFT');

  await assert.rejects(
    () => updateJob(secondDraft.id, actor('recruiter-1'), {
      title: 'Data Analyst - CHANGED', description: 'Own analytics', skillsRequired: ['SQL'],
      experienceMin: 2, experienceMax: 5, location: 'Remote', status: 'OPEN',
    }, 'org-1'),
    (error) => error.code === 'JOB_POSTING_QUOTA_EXCEEDED',
  );

  const reFetched = state.jobs.find((item) => item.id === secondDraft.id);
  assert.equal(reFetched.status, 'DRAFT', 'status must not change on a rolled-back publish attempt');
  assert.equal(reFetched.title, 'Data Analyst', 'other field edits must also roll back atomically with the credit failure');
  void created;
});

test('editing an already-OPEN job (no status change) never touches the credit ledger', async () => {
  state.creditBalance = 1;
  const created = await createJob(actor('recruiter-1'), {
    title: 'Support Engineer', description: 'Help customers', skillsRequired: ['Zendesk'],
    experienceMin: 1, experienceMax: 4, location: 'Remote', status: 'OPEN',
  }, 'org-1');
  assert.equal(state.creditBalance, 0);
  assert.equal(state.ledger.length, 1);

  const edited = await updateJob(created.id, actor('recruiter-1'), {
    title: 'Support Engineer II', description: 'Help customers', skillsRequired: ['Zendesk'],
    experienceMin: 1, experienceMax: 4, location: 'Remote', status: 'OPEN',
  }, 'org-1');

  assert.equal(edited.title, 'Support Engineer II');
  assert.equal(state.ledger.length, 1, 'editing an already-open job must not consume a second credit');
});
