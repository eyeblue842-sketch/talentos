import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import {
  completeInitialSetup,
  getInitialSetupStatus,
  resetInitialSetup,
} from '../services/setupService.js';

function clone(value) {
  return structuredClone(value);
}

function installPrismaMock(state, options = {}) {
  const original = {
    $transaction: prisma.$transaction,
    organisation: prisma.organisation,
    user: prisma.user,
    organisationMembership: prisma.organisationMembership,
    organisationSettings: prisma.organisationSettings,
    featureFlag: prisma.featureFlag,
    platformSetupState: prisma.platformSetupState,
    auditLog: prisma.auditLog,
    organisationRoleDefinition: prisma.organisationRoleDefinition,
    job: prisma.job,
    application: prisma.application,
    interviewRound: prisma.interviewRound,
    offer: prisma.offer,
  };

  function buildClient(targetState) {
    return {
      organisation: {
        count: async () => targetState.organisations.length,
        findUnique: async ({ where }) => clone(targetState.organisations.find((item) => (
          (where.id && item.id === where.id) || (where.slug && item.slug === where.slug)
        )) || null),
        create: async ({ data }) => {
          const item = { id: `org-${targetState.organisations.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
          targetState.organisations.push(item);
          return clone(item);
        },
        delete: async ({ where }) => {
          targetState.organisations = targetState.organisations.filter((item) => item.id !== where.id);
          targetState.organisationMemberships = targetState.organisationMemberships.filter((item) => item.organisationId !== where.id);
          targetState.organisationSettings = targetState.organisationSettings.filter((item) => item.organisationId !== where.id);
          targetState.featureFlags = targetState.featureFlags.filter((item) => item.organisationId !== where.id);
          targetState.roleDefinitions = targetState.roleDefinitions.filter((item) => item.organisationId !== where.id);
        },
      },
      user: {
        count: async ({ where } = {}) => targetState.users.filter((item) => {
          if (!where) return true;
          if (where.role && item.role !== where.role) return false;
          if (where.isActive != null && item.isActive !== where.isActive) return false;
          if (where.accountStatus && item.accountStatus !== where.accountStatus) return false;
          return true;
        }).length,
        findUnique: async ({ where }) => clone(targetState.users.find((item) => (
          (where.id && item.id === where.id) || (where.email && item.email === where.email)
        )) || null),
        create: async ({ data }) => {
          if (options.failUserCreate) {
            throw Object.assign(new Error('forced user create failure'), { statusCode: 500 });
          }
          const item = {
            id: `user-${targetState.users.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            sessionVersion: 0,
            mfaEnabled: false,
            lastLoginAt: null,
            ...data,
          };
          targetState.users.push(item);
          return clone(item);
        },
        delete: async ({ where }) => {
          targetState.users = targetState.users.filter((item) => item.id !== where.id);
        },
      },
      organisationMembership: {
        create: async ({ data }) => {
          const item = { id: `mem-${targetState.organisationMemberships.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
          targetState.organisationMemberships.push(item);
          return clone(item);
        },
        findFirst: async ({ where }) => clone(targetState.organisationMemberships.find((item) => (
          (!where.userId || item.userId === where.userId)
        )) || null),
      },
      organisationSettings: {
        findUnique: async ({ where }) => clone(targetState.organisationSettings.find((item) => item.organisationId === where.organisationId) || null),
        create: async ({ data }) => {
          const item = { id: `settings-${targetState.organisationSettings.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
          targetState.organisationSettings.push(item);
          return clone(item);
        },
        update: async ({ where, data }) => {
          const item = targetState.organisationSettings.find((entry) => entry.id === where.id || entry.organisationId === where.organisationId);
          Object.assign(item, data, { updatedAt: new Date() });
          return clone(item);
        },
      },
      featureFlag: {
        createMany: async ({ data }) => {
          for (const entry of data) {
            if (!targetState.featureFlags.find((item) => item.organisationId === entry.organisationId && item.key === entry.key)) {
              targetState.featureFlags.push({ id: `flag-${targetState.featureFlags.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...entry });
            }
          }
          return { count: data.length };
        },
      },
      platformSetupState: {
        findUnique: async ({ where }) => clone(targetState.platformSetupState.find((item) => item.id === where.id) || null),
        upsert: async ({ where, create, update }) => {
          const existing = targetState.platformSetupState.find((item) => item.id === where.id);
          if (existing) {
            Object.assign(existing, update, { updatedAt: new Date() });
            return clone(existing);
          }
          const item = { createdAt: new Date(), updatedAt: new Date(), ...create };
          targetState.platformSetupState.push(item);
          return clone(item);
        },
      },
      auditLog: {
        create: async ({ data }) => {
          const item = { id: `audit-${targetState.auditLogs.length + 1}`, createdAt: new Date(), ...data };
          targetState.auditLogs.push(item);
          return clone(item);
        },
      },
      organisationRoleDefinition: {
        findMany: async ({ where }) => clone(targetState.roleDefinitions.filter((item) => item.organisationId === where.organisationId && item.archivedAt == null)),
        createMany: async ({ data }) => {
          for (const entry of data) {
            targetState.roleDefinitions.push({ id: `role-${targetState.roleDefinitions.length + 1}`, createdAt: new Date(), updatedAt: new Date(), archivedAt: null, ...entry });
          }
          return { count: data.length };
        },
      },
      job: { count: async () => targetState.jobs.length },
      application: { count: async () => targetState.applications.length },
      interviewRound: { count: async () => targetState.interviewRounds.length },
      offer: { count: async () => targetState.offers.length },
    };
  }

  const client = buildClient(state);

  prisma.organisation = client.organisation;
  prisma.user = client.user;
  prisma.organisationMembership = client.organisationMembership;
  prisma.organisationSettings = client.organisationSettings;
  prisma.featureFlag = client.featureFlag;
  prisma.platformSetupState = client.platformSetupState;
  prisma.auditLog = client.auditLog;
  prisma.organisationRoleDefinition = client.organisationRoleDefinition;
  prisma.job = client.job;
  prisma.application = client.application;
  prisma.interviewRound = client.interviewRound;
  prisma.offer = client.offer;
  prisma.$transaction = async (callback) => {
    const draft = clone(state);
    const tx = buildClient(draft);
    const result = await callback(tx);
    Object.assign(state, draft);
    prisma.organisation = buildClient(state).organisation;
    prisma.user = buildClient(state).user;
    prisma.organisationMembership = buildClient(state).organisationMembership;
    prisma.organisationSettings = buildClient(state).organisationSettings;
    prisma.featureFlag = buildClient(state).featureFlag;
    prisma.platformSetupState = buildClient(state).platformSetupState;
    prisma.auditLog = buildClient(state).auditLog;
    prisma.organisationRoleDefinition = buildClient(state).organisationRoleDefinition;
    prisma.job = buildClient(state).job;
    prisma.application = buildClient(state).application;
    prisma.interviewRound = buildClient(state).interviewRound;
    prisma.offer = buildClient(state).offer;
    return result;
  };

  return () => {
    prisma.$transaction = original.$transaction;
    prisma.organisation = original.organisation;
    prisma.user = original.user;
    prisma.organisationMembership = original.organisationMembership;
    prisma.organisationSettings = original.organisationSettings;
    prisma.featureFlag = original.featureFlag;
    prisma.platformSetupState = original.platformSetupState;
    prisma.auditLog = original.auditLog;
    prisma.organisationRoleDefinition = original.organisationRoleDefinition;
    prisma.job = original.job;
    prisma.application = original.application;
    prisma.interviewRound = original.interviewRound;
    prisma.offer = original.offer;
  };
}

function createState() {
  return {
    organisations: [],
    users: [],
    organisationMemberships: [],
    organisationSettings: [],
    featureFlags: [],
    platformSetupState: [],
    auditLogs: [],
    roleDefinitions: [],
    jobs: [],
    applications: [],
    interviewRounds: [],
    offers: [],
  };
}

const validPayload = {
  organisation: {
    companyName: 'Acme Labs',
    companyLogoUrl: '',
    industry: 'Software',
    country: 'India',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    dateFormat: 'DD MMM YYYY',
  },
  superAdmin: {
    name: 'Priya Menon',
    email: 'admin@acme.test',
    mobile: '+91 9999999999',
    password: 'StrongPass#2026',
    confirmPassword: 'StrongPass#2026',
  },
  preferences: {
    language: 'English',
    defaultMeetingProvider: 'CUSTOM',
    googleEnabled: false,
    zoomEnabled: true,
    emailProvider: 'SMTP',
    aiEnabled: true,
    notificationPreferences: {
      email: true,
      inApp: true,
    },
  },
};

test('fresh installation reports setup incomplete, creates the first organisation and super admin, hashes password, and records audit', async () => {
  const state = createState();
  const restore = installPrismaMock(state);

  try {
    const before = await getInitialSetupStatus();
    assert.equal(before.initialized, false);

    const result = await completeInitialSetup(validPayload, { ipAddress: '127.0.0.1', userAgent: 'test' });
    assert.equal(result.initialized, true);
    assert.equal(state.organisations.length, 1);
    assert.equal(state.users.length, 1);
    assert.equal(state.users[0].role, 'ADMIN');
    assert.equal(state.users[0].name, validPayload.superAdmin.name);
    assert.equal(state.users[0].phoneNumber, validPayload.superAdmin.mobile);
    assert.notEqual(state.users[0].passwordHash, validPayload.superAdmin.password);
    assert.equal(await bcrypt.compare(validPayload.superAdmin.password, state.users[0].passwordHash), true);
    assert.equal(state.platformSetupState[0].setupCompleted, true);
    assert.equal(state.auditLogs.length, 1);
  } finally {
    restore();
  }
});

test('existing installation reports initialized even without an explicit setup-state row', async () => {
  const state = createState();
  state.organisations.push({ id: 'org-1', slug: 'acme', name: 'Acme', createdAt: new Date(), updatedAt: new Date() });
  state.users.push({ id: 'user-1', email: 'admin@acme.test', role: 'ADMIN', isActive: true, accountStatus: 'ACTIVE', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() });
  const restore = installPrismaMock(state);

  try {
    const status = await getInitialSetupStatus();
    assert.equal(status.initialized, true);
    assert.equal(status.hasOrganisation, true);
    assert.equal(status.hasSuperAdmin, true);
  } finally {
    restore();
  }
});

test('duplicate super admin email is rejected', async () => {
  const state = createState();
  state.users.push({ id: 'user-1', email: 'admin@acme.test', role: 'ADMIN', isActive: true, accountStatus: 'ACTIVE', passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date() });
  const restore = installPrismaMock(state);

  try {
    await assert.rejects(() => completeInitialSetup(validPayload), { statusCode: 409 });
  } finally {
    restore();
  }
});

test('setup creation is transactional and does not leave partial data on failure', async () => {
  const state = createState();
  const restore = installPrismaMock(state, { failUserCreate: true });

  try {
    await assert.rejects(() => completeInitialSetup(validPayload), /forced user create failure/i);
    assert.equal(state.organisations.length, 0);
    assert.equal(state.users.length, 0);
    assert.equal(state.platformSetupState.length, 0);
  } finally {
    restore();
  }
});

test('reset requires an admin password and is blocked once operational data exists', async () => {
  const state = createState();
  const passwordHash = await bcrypt.hash('StrongPass#2026', 12);
  state.organisations.push({ id: 'org-1', slug: 'acme', name: 'Acme', createdAt: new Date(), updatedAt: new Date() });
  state.users.push({ id: 'user-1', email: 'admin@acme.test', role: 'ADMIN', isActive: true, accountStatus: 'ACTIVE', passwordHash, createdAt: new Date(), updatedAt: new Date() });
  state.organisationMemberships.push({ id: 'mem-1', organisationId: 'org-1', userId: 'user-1', role: 'OWNER', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() });
  state.jobs.push({ id: 'job-1' });
  const restore = installPrismaMock(state);

  try {
    await assert.rejects(() => resetInitialSetup(state.users[0], 'wrong-password'), { statusCode: 403 });
    await assert.rejects(() => resetInitialSetup(state.users[0], 'StrongPass#2026'), { statusCode: 409 });
  } finally {
    restore();
  }
});
