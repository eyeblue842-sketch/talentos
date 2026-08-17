import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Default posture: BILLING_ENTITLEMENT_ENFORCEMENT_ENABLED unset ('false').
// Proves that publishing a job (createJob/updateJob with status: 'OPEN')
// behaves exactly like the pre-billing codebase when enforcement is off -
// no credit is checked or consumed, and the ledger is never touched at all
// (see the poisoned $queryRaw/jobPostingCreditLedger mocks below, which
// throw immediately if the disabled code path ever tries to reach them).

let prisma;
let createJob;
let updateJob;
let state;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function poison(label) {
  return async () => {
    throw new Error(`${label} must not be called while entitlement enforcement is disabled.`);
  };
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
  prisma.$transaction = async (callback) => callback(prisma);
  // Poisoned: any attempt to reach the credit ledger while disabled fails
  // the test immediately and clearly, instead of silently succeeding or
  // hanging on a real network call.
  prisma.$queryRaw = poison('prisma.$queryRaw (job credit balance check)');
  prisma.jobPostingCreditLedger = { create: poison('jobPostingCreditLedger.create (credit consumption)') };
});

test('createJob with status OPEN publishes immediately without consuming any credit when enforcement is disabled', async () => {
  const job = await createJob(actor('recruiter-1'), {
    title: 'Backend Engineer',
    description: 'Build APIs',
    skillsRequired: ['Node.js'],
    experienceMin: 3,
    experienceMax: 6,
    location: 'Remote',
    status: 'OPEN',
  }, 'org-1');

  assert.equal(job.status, 'OPEN');
  assert.ok(job.activatedAt);
  assert.ok(job.activeUntil);
  assert.equal(state.auditLogs.some((log) => log.action === 'job.create_and_publish'), true);
});

test('updateJob transitioning DRAFT -> OPEN publishes without consuming any credit when enforcement is disabled', async () => {
  const created = await createJob(actor('recruiter-1'), {
    title: 'Product Designer',
    description: 'Own UI design',
    skillsRequired: ['Figma'],
    experienceMin: 3,
    experienceMax: 6,
    location: 'Remote',
  }, 'org-1');
  assert.equal(created.status, 'DRAFT');

  const published = await updateJob(created.id, actor('recruiter-1'), {
    title: 'Product Designer',
    description: 'Own UI design, revised',
    skillsRequired: ['Figma'],
    experienceMin: 3,
    experienceMax: 6,
    location: 'Remote',
    status: 'OPEN',
  }, 'org-1');

  assert.equal(published.status, 'OPEN');
  assert.equal(published.description, 'Own UI design, revised');
  assert.ok(published.activatedAt);
});
